import getDb from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });
    }

    let dateFilter = '';
    const params: any[] = [userId];

    if (dateFrom && dateTo) {
      dateFilter = 'AND o.createdAt >= ? AND o.createdAt <= ?';
      params.push(dateFrom + ' 00:00:00', dateTo + ' 23:59:59');
    } else if (dateFrom) {
      dateFilter = 'AND o.createdAt >= ?';
      params.push(dateFrom + ' 00:00:00');
    } else if (dateTo) {
      dateFilter = 'AND o.createdAt <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    const query = `
      SELECT 
        p.id as productId,
        p.name as productName,
        pv.id as variantId,
        pv.size as variantSize,
        pv.color as variantColor,
        pv.purchasePrice,
        pv.price as currentPrice,
        COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) as totalQuantitySold,
        COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.totalPrice ELSE 0 END), 0) as totalRevenue
      FROM product_variants pv
      JOIN products p ON pv.productId = p.id
      LEFT JOIN order_items oi ON oi.variantId = pv.id
      LEFT JOIN orders o ON oi.orderId = o.id AND o.status IN ('delivered', 'paid') ${dateFilter.replace('o.createdAt', 'o.createdAt')}
      WHERE p.userId = ? AND p.isActive = 1
      GROUP BY pv.id
      ORDER BY totalRevenue DESC, p.name ASC
    `;

    const results = db.prepare(query).all(...params) as any[];

    const profitStats = results.map(row => {
      const totalCost = row.purchasePrice * row.totalQuantitySold;
      const profit = row.totalRevenue - totalCost;
      const unitRevenue = row.totalQuantitySold > 0 ? row.totalRevenue / row.totalQuantitySold : row.currentPrice;
      const unitMargin = unitRevenue - row.purchasePrice;
      
      return {
        productId: row.productId,
        productName: row.productName,
        variantId: row.variantId,
        variantSize: row.variantSize,
        variantColor: row.variantColor,
        quantitySold: row.totalQuantitySold,
        revenue: row.totalRevenue,
        purchasePrice: row.purchasePrice,
        unitRevenue: unitRevenue,
        unitMargin: unitMargin,
        totalCost: totalCost,
        profit: profit
      };
    });

    return NextResponse.json({ success: true, stats: profitStats });
  } catch (error: any) {
    console.error('Erreur API profit:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
