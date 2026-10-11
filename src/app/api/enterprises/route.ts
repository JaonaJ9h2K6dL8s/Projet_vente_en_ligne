import getDb from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');

    if (!ownerId) {
      return NextResponse.json({ error: 'Owner ID requis' }, { status: 400 });
    }

    const enterprises = db.prepare('SELECT id, name, description, logoUrl, themeColor, receiptTemplate, receiptAccentColor, ownerId, createdAt FROM enterprises WHERE ownerId = ? ORDER BY createdAt ASC').all(ownerId);
    
    return NextResponse.json({ enterprises }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Enterprises GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, description, logoUrl, themeColor, receiptTemplate, receiptAccentColor } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID et Nom requis' }, { status: 400 });
    }

    // Prepare update query
    let query = 'UPDATE enterprises SET name = ?, description = ?, logoUrl = ?, themeColor = ?';
    const params: any[] = [name, description || '', logoUrl || '', themeColor || 'teal'];

    if (receiptTemplate !== undefined) {
      query += ', receiptTemplate = ?';
      params.push(receiptTemplate);
    }
    if (receiptAccentColor !== undefined) {
      query += ', receiptAccentColor = ?';
      params.push(receiptAccentColor);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.prepare(query).run(...params);

    const updatedEnterprise = db.prepare('SELECT * FROM enterprises WHERE id = ?').get(id);
    return NextResponse.json({ enterprise: updatedEnterprise });
  } catch (error) {
    console.error('Enterprises PUT error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, description, logoUrl, themeColor, ownerId } = body;

    if (!name || !ownerId) {
      return NextResponse.json({ error: 'Nom et Owner ID requis' }, { status: 400 });
    }

    const id = 'ent_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

    db.prepare('INSERT INTO enterprises (id, name, description, logoUrl, themeColor, ownerId) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, 
      name, 
      description || '', 
      logoUrl || '', 
      themeColor || 'teal', 
      ownerId
    );

    const newEnterprise = db.prepare('SELECT id, name, description, logoUrl, themeColor, receiptTemplate, receiptAccentColor, ownerId, createdAt FROM enterprises WHERE id = ?').get(id);

    return NextResponse.json({ enterprise: newEnterprise }, { status: 201 });
  } catch (error) {
    console.error('Enterprises POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}