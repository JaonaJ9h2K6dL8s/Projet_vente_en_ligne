import getDb from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    
    const { userId, username = '', importData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });
    }

    if (!importData || !Array.isArray(importData.produits)) {
      return NextResponse.json({ error: 'Format de données invalide' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const archiveDate = now.slice(0, 10);

    const transaction = db.transaction(() => {
      // 1. Archiver l'ancien stock actif pour cette entreprise
      const activeProducts = db.prepare('SELECT id, name FROM products WHERE userId = ? AND isActive = 1').all(userId) as Array<{id: string, name: string}>;
      
      for (const product of activeProducts) {
        const archivedName = product.name.startsWith('[ARCHIVE') ? product.name : `[ARCHIVE ${archiveDate}] ${product.name}`;
        db.prepare('UPDATE products SET isActive = 0, name = ?, updatedAt = ? WHERE id = ?').run(archivedName, now, product.id);
        db.prepare('UPDATE product_variants SET stock = 0 WHERE productId = ?').run(product.id);
      }

      // 2. Insérer les nouveaux produits depuis le JSON importé
      const insertProduct = db.prepare(
        'INSERT INTO products (id, userId, code, name, description, category, unit, imageUrl, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insertVariant = db.prepare(
        'INSERT INTO product_variants (id, productId, size, color, price, purchasePrice, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );

      for (const p of importData.produits) {
        const productId = uuidv4();
        
        insertProduct.run(
          productId,
          userId,
          p.id || '', // code
          p.produit || 'Produit inconnu', // name
          `Importé le ${archiveDate}`, // description
          'Import', // category par défaut
          '', // unit
          '', // imageUrl
          1, // isActive
          now, // createdAt
          now // updatedAt
        );

        // Grouper les codes par taille et couleur pour compter le stock
        const variantsMap = new Map<string, { size: string, color: string, count: number, codes: string[], sumPurchasePrices: number }>();
        
        if (Array.isArray(p.codes)) {
          for (const codeItem of p.codes) {
            const size = codeItem.taille || 'Standard';
            const color = codeItem.couleur || 'Standard';
            const key = `${size}-${color}`;
            
            if (!variantsMap.has(key)) {
              variantsMap.set(key, { size, color, count: 0, codes: [], sumPurchasePrices: 0 });
            }
            variantsMap.get(key)!.count += 1;
            if (codeItem.code) {
              variantsMap.get(key)!.codes.push(codeItem.code);
            }
            if (codeItem.prixUnitaire) {
              variantsMap.get(key)!.sumPurchasePrices += Number(codeItem.prixUnitaire);
            }
          }
        }

        // Si aucun code mais une quantité globale est fournie
        if (variantsMap.size === 0 && p.quantite > 0) {
           variantsMap.set('Standard-Standard', { size: 'Standard', color: 'Standard', count: p.quantite, codes: [], sumPurchasePrices: Number(p.prixUnitaire || 0) * p.quantite });
        }

        // Créer les variantes
        const globalPurchasePrice = Number(p.prixUnitaire || p.prix || p.price || p.valeur || 0);

        for (const [_, variantData] of variantsMap) {
          // Calcul de la moyenne du prix d'achat si différents prix unitaires existent pour les codes
          const variantPurchasePrice = variantData.sumPurchasePrices > 0 && variantData.count > 0 
            ? variantData.sumPurchasePrices / variantData.count 
            : globalPurchasePrice;

          insertVariant.run(
            uuidv4(),
            productId,
            variantData.size,
            variantData.color,
            0, // price (Prix à revendre) par défaut à 0
            variantPurchasePrice, // purchasePrice (Prix d'achat ou envoyé)
            variantData.count, // stock calculé
            variantData.codes.join(' | ') // sku
          );
        }
      }

      // 3. Ajouter log d'activité
      db.prepare(
        'INSERT INTO activity_logs (id, userId, username, action, entity, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, username, 'import', 'stock', 'all', `Importation complète de ${importData.produits.length} produits (Ancien stock archivé).`);
    });

    transaction();

    return NextResponse.json({ success: true, message: 'Stock importé avec succès' });

  } catch (error: any) {
    console.error('Erreur lors de l\'importation:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'importation: ' + error.message }, { status: 500 });
  }
}
