import getDb from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });
    }

    const statsQuery = `
      SELECT 
        p.id as productId,
        p.name as productName,
        v.id as variantId,
        v.size as variantSize,
        v.color as variantColor,
        v.sku as variantCodes,
        v.stock as currentStock,
        v.price as currentPrice,
        v.purchasePrice,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE oi.variantId = v.id AND o.status IN ('delivered', 'paid')
        ) as soldQuantity,
        (
          SELECT COALESCE(SUM(oi.quantity * oi.unitPrice), 0)
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE oi.variantId = v.id AND o.status IN ('delivered', 'paid')
        ) as soldValue,
        (
          SELECT GROUP_CONCAT(oi.variantSize, '||')
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE oi.variantId = v.id AND o.status IN ('delivered', 'paid')
        ) as soldDetails,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE oi.variantId = v.id AND o.status = 'pending'
        ) as pendingQuantity,
        (
          SELECT COALESCE(SUM(oi.quantity * oi.unitPrice), 0)
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE oi.variantId = v.id AND o.status = 'pending'
        ) as pendingValue,
        (
          SELECT GROUP_CONCAT(oi.variantSize, '||')
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE oi.variantId = v.id AND o.status = 'pending'
        ) as pendingDetails
      FROM products p
      JOIN product_variants v ON v.productId = p.id
      WHERE p.userId = ? AND p.isActive = 1
      ORDER BY p.name ASC, v.size ASC, v.color ASC
    `;

    const rawStats = db.prepare(statsQuery).all(userId) as any[];

    // Grouper par produit
    const productsMap = new Map<string, any>();
    
    for (const row of rawStats) {
      // Calculer la quantité initiale basée sur les codes d'importation (sku)
      let initialQuantity = 0;
      if (row.variantCodes) {
        if (row.variantCodes.includes('|')) {
          initialQuantity = row.variantCodes.split('|').filter((c: string) => c.trim().length > 0).length;
        } else if (row.variantCodes.includes(',')) {
          // Si le code contient une virgule mais pas de pipe, c'est peut-être une liste de codes
          // Sauf si c'est un ensemble genre "AA-005(Noir),AB-015(Noir)" qui n'a pas d'espace après la virgule.
          if (row.variantCodes.includes(', ')) {
            initialQuantity = row.variantCodes.split(', ').filter((c: string) => c.trim().length > 0).length;
          } else {
             // Si c'est juste "CodeA,CodeB" sans espace, on considère ça comme 1 code (comme les ensembles)
             initialQuantity = 1;
          }
        } else {
          initialQuantity = 1;
        }
      } else {
        // Fallback
        initialQuantity = row.currentStock + row.soldQuantity + row.pendingQuantity;
      }

      // Si par hasard le calcul donne 0 alors qu'il y a du stock
      if (initialQuantity === 0) {
        initialQuantity = row.currentStock + row.soldQuantity + row.pendingQuantity;
      }

      const initialPurchaseValue = initialQuantity * row.purchasePrice;
      const initialResaleValue = initialQuantity * row.currentPrice;
      const currentStockValue = row.currentStock * row.currentPrice;
      const currentStockPurchaseValue = row.currentStock * row.purchasePrice;

      if (!productsMap.has(row.productId)) {
        productsMap.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          initialQuantity: 0,
          initialPurchaseValue: 0,
          initialResaleValue: 0,
          currentStock: 0,
          currentStockValue: 0,
          currentStockPurchaseValue: 0,
          soldQuantity: 0,
          soldValue: 0,
          pendingQuantity: 0,
          pendingValue: 0,
          variants: []
        });
      }
      
      const p = productsMap.get(row.productId);
      p.initialQuantity += initialQuantity;
      p.initialPurchaseValue += initialPurchaseValue;
      p.initialResaleValue += initialResaleValue;
      p.currentStock += row.currentStock;
      p.currentStockValue += currentStockValue;
      p.currentStockPurchaseValue += currentStockPurchaseValue;
      p.soldQuantity += row.soldQuantity;
      p.soldValue += row.soldValue;
      p.pendingQuantity += row.pendingQuantity;
      p.pendingValue += row.pendingValue;
      
      // Extract codes from soldDetails and pendingDetails
      const extractCodes = (detailsStr: string) => {
        if (!detailsStr) return [];
        const parts = detailsStr.split('||');
        const codes = [];
        for (const part of parts) {
          // 1. Essayer d'extraire via le pattern (Code: ...)
          const match = part.match(/\(Code:\s*(.*)\)/);
          if (match && match[1]) {
            codes.push(match[1].trim());
          } else {
            // 2. Si pas de pattern, peut-être que le champ size entier est le code
            // On vérifie si ce "size" ressemble à un de nos codes connus (on verra au frontend)
            // Pour l'instant on ne l'ajoute pas aux codes pour éviter les faux positifs (comme "XXL")
          }
        }
        return codes;
      };

      p.variants.push({
        variantId: row.variantId,
        variantSize: row.variantSize,
        variantColor: row.variantColor,
        variantCodes: row.variantCodes,
        initialQuantity: initialQuantity,
        initialPurchaseValue: initialPurchaseValue,
        initialResaleValue: initialResaleValue,
        currentStock: row.currentStock,
        currentStockValue: currentStockValue,
        currentStockPurchaseValue: currentStockPurchaseValue,
        soldQuantity: row.soldQuantity,
        soldValue: row.soldValue,
        soldCodes: extractCodes(row.soldDetails),
        pendingQuantity: row.pendingQuantity,
        pendingValue: row.pendingValue,
        pendingCodes: extractCodes(row.pendingDetails)
      });
    }

    const stats = Array.from(productsMap.values());

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Erreur get stock statistics:', error);
    return NextResponse.json({ error: 'Erreur lors du chargement des statistiques' }, { status: 500 });
  }
}
