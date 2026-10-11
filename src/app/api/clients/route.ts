import getDb from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const userId = searchParams.get('userId') || '';
    const includeArchived = searchParams.get('includeArchived') === '1';
    const archivedOnly = searchParams.get('archivedOnly') === '1';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });
    }

    let whereClause = 'WHERE userId = ?';
    const params: (string | number)[] = [userId];

    if (archivedOnly) {
      whereClause += ' AND isActive = 0';
    } else if (!includeArchived) {
      whereClause += ' AND isActive = 1';
    }

    if (search) {
      const searchPattern = `%${search}%`;
      whereClause += ' AND (name LIKE ? OR facebookPseudo LIKE ? OR phone LIKE ? OR nif LIKE ? OR stat LIKE ?)';
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const clients = db.prepare(
      `SELECT * FROM clients ${whereClause} ORDER BY updatedAt DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM clients ${whereClause}`
    ).get(...params) as { count: number };

    return NextResponse.json({ clients, total: total.count, page, limit });
  } catch (error) {
    console.error('Get clients error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const id = uuidv4();
    const now = new Date().toISOString();
    const userId = body.userId;
    const username = body.username || '';

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });
    }

    db.prepare(
      'INSERT INTO clients (id, userId, name, facebookPseudo, nif, stat, phone, address, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, body.name, body.facebookPseudo || '', body.nif || '', body.stat || '', body.phone || '', body.address || '', body.notes || '', now, now);

    db.prepare(
      'INSERT INTO activity_logs (id, userId, username, action, entity, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, username, 'create', 'client', id, `Client créé: ${body.name}`);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const now = new Date().toISOString();
    const userId = body.userId;
    const username = body.username || '';

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });
    }

    const result = db.prepare(
      'UPDATE clients SET name = ?, facebookPseudo = ?, nif = ?, stat = ?, phone = ?, address = ?, notes = ?, updatedAt = ? WHERE id = ? AND userId = ?'
    ).run(body.name, body.facebookPseudo || '', body.nif || '', body.stat || '', body.phone || '', body.address || '', body.notes || '', now, body.id, userId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });
    }

    db.prepare(
      'INSERT INTO activity_logs (id, userId, username, action, entity, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, username, 'update', 'client', body.id, `Client modifié: ${body.name}`);

    const client = db.prepare('SELECT * FROM clients WHERE id = ? AND userId = ?').get(body.id, userId);
    return NextResponse.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId') || '';
    const username = searchParams.get('username') || '';
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 });

    const client = db.prepare('SELECT name FROM clients WHERE id = ? AND userId = ?').get(id, userId) as { name: string } | undefined;
    if (!client) return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });

    try {
      db.prepare('DELETE FROM clients WHERE id = ? AND userId = ?').run(id, userId);

      db.prepare(
        'INSERT INTO activity_logs (id, userId, username, action, entity, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, username, 'delete', 'client', id, `Client supprimé: ${client?.name || id}`);

      return NextResponse.json({ success: true, mode: 'deleted' });
    } catch {
      // If delete fails (e.g. constraint violation from orders), archive it instead
      const now = new Date().toISOString();
      const archiveDate = now.slice(0, 10);
      const archivedName = client.name.startsWith('[ARCHIVE') ? client.name : `[ARCHIVE ${archiveDate}] ${client.name}`;

      db.prepare('UPDATE clients SET isActive = 0, name = ?, updatedAt = ? WHERE id = ? AND userId = ?')
        .run(archivedName, now, id, userId);

      db.prepare(
        'INSERT INTO activity_logs (id, userId, username, action, entity, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), userId, username, 'archive', 'client', id, `Client archivé (lié à des commandes): ${client.name}`);

      return NextResponse.json({ success: true, mode: 'archived' });
    }
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
