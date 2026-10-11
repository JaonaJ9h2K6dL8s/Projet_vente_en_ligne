'use client';

import StatCard from '@/components/common/StatCard';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/authStore';
import type { Order } from '@/types';
import {
  AttachMoney,
  CalendarMonth,
  Inventory2,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';

type DailyArticleSales = {
  date: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  revenue: number;
  ordersCount: number;
};

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProductKey(productName: string, variantSize: string) {
  const sizeTokens = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl', '5xl']);
  const normalizedName = normalizeText(productName);
  const normalizedVariantSize = normalizeText(variantSize);
  const tokens = normalizedName.split(' ').filter(Boolean);
  if (tokens.length === 0) return normalizedName;
  const lastToken = tokens[tokens.length - 1];
  if (sizeTokens.has(lastToken) || (normalizedVariantSize && lastToken === normalizedVariantSize)) {
    return tokens.slice(0, -1).join(' ').trim() || normalizedName;
  }
  return normalizedName;
}

export default function SalesAnalysisPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { selectedUserId, startDataLoading, endDataLoading, setDataError } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date()));
  const [rows, setRows] = useState<DailyArticleSales[]>([]);

  const formatMoney = (amount: number) => amount.toLocaleString('fr-FR').replace(/\s/g, '.');

  const fetchAllOrders = useCallback(async () => {
    if (!selectedUserId) {
      setRows([]);
      return;
    }

    setLoading(true);
    startDataLoading();
    try {
      const allOrders: Order[] = [];
      const pageSize = 500;
      let page = 1;
      let total = 0;

      do {
        const params = new URLSearchParams({
          userId: selectedUserId,
          dateFrom,
          dateTo,
          page: String(page),
          limit: String(pageSize),
        });
        const res = await fetch(`/api/orders?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Erreur chargement ventes');
        }

        const orders = (data.orders || []) as Order[];
        total = Number(data.total || 0);
        allOrders.push(...orders);
        page += 1;

        if (orders.length === 0) break;
      } while (allOrders.length < total);

      const grouped = new Map<string, DailyArticleSales & { orderIds: Set<string> }>();

      allOrders.forEach((order) => {
        if (order.status === 'cancelled') return;
        const orderDate = order.createdAt ? order.createdAt.slice(0, 10) : '';
        if (!orderDate) return;

        (order.items || []).forEach((item) => {
          const productName = (item.productName || 'Produit').trim();
          const variantLabel = `${item.variantSize || ''} ${item.variantColor || ''}`.trim() || '-';
          const normalizedProduct = normalizeProductKey(productName, item.variantSize || '');
          const normalizedVariant = normalizeText(variantLabel);
          const key = `${orderDate}__${normalizedProduct}__${normalizedVariant}`;
          const current = grouped.get(key);
          if (current) {
            current.quantity += Number(item.quantity || 0);
            current.revenue += Number(item.totalPrice || 0);
            current.orderIds.add(order.id);
          } else {
            grouped.set(key, {
              date: orderDate,
              productName,
              variantLabel,
              quantity: Number(item.quantity || 0),
              revenue: Number(item.totalPrice || 0),
              ordersCount: 1,
              orderIds: new Set([order.id]),
            });
          }
        });
      });

      const nextRows = Array.from(grouped.values())
        .map((entry) => ({
          date: entry.date,
          productName: entry.productName,
          variantLabel: entry.variantLabel,
          quantity: entry.quantity,
          revenue: entry.revenue,
          ordersCount: entry.orderIds.size,
        }))
        .sort((a, b) => (a.date === b.date ? b.quantity - a.quantity : b.date.localeCompare(a.date)));

      setRows(nextRows);
      setDataError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur chargement analyse ventes';
      setDataError(message);
      enqueueSnackbar(message, { variant: 'error' });
      setRows([]);
    } finally {
      setLoading(false);
      endDataLoading();
    }
  }, [dateFrom, dateTo, selectedUserId, startDataLoading, endDataLoading, setDataError, enqueueSnackbar]);

  useEffect(() => {
    fetchAllOrders();
  }, [fetchAllOrders]);

  const stats = useMemo(() => {
    const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const daysCount = new Set(rows.map((row) => row.date)).size;
    const totalLines = rows.length;
    return { totalQuantity, totalRevenue, daysCount, totalLines };
  }, [rows]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Analyser vente" subtitle="Analyse des ventes de produits par jour" />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ p: 3 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  label="Date début"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Date fin"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Button variant="contained" onClick={fetchAllOrders} disabled={loading || !selectedUserId}>
                  Filtrer
                </Button>
              </CardContent>
            </Card>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <StatCard
                  title="Lignes d'articles"
                  value={stats.totalLines}
                  icon={<Inventory2 />}
                  color="#1565C0"
                  bgColor="rgba(21, 101, 192, 0.12)"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <StatCard
                  title="Jours analysés"
                  value={stats.daysCount}
                  icon={<CalendarMonth />}
                  color="#6A1B9A"
                  bgColor="rgba(106, 27, 154, 0.12)"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <StatCard
                  title="Quantité vendue"
                  value={stats.totalQuantity}
                  icon={<ShoppingCart />}
                  color="#2E7D32"
                  bgColor="rgba(46, 125, 50, 0.12)"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <StatCard
                  title="Chiffre d'affaires"
                  value={`${formatMoney(stats.totalRevenue)} Ar`}
                  icon={<AttachMoney />}
                  color="#EF6C00"
                  bgColor="rgba(239, 108, 0, 0.12)"
                />
              </Grid>
            </Grid>

            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Articles vendus par jour
                </Typography>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Article</TableCell>
                          <TableCell>Variante</TableCell>
                          <TableCell align="right">Quantité</TableCell>
                          <TableCell align="right">Nombre commandes</TableCell>
                          <TableCell align="right">Montant</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={`${row.date}-${row.productName}-${row.variantLabel}`}>
                            <TableCell>{new Date(row.date).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>{row.productName}</TableCell>
                            <TableCell>{row.variantLabel}</TableCell>
                            <TableCell align="right">{row.quantity}</TableCell>
                            <TableCell align="right">{row.ordersCount}</TableCell>
                            <TableCell align="right">{formatMoney(row.revenue)} Ar</TableCell>
                          </TableRow>
                        ))}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                              Aucune vente trouvée pour cette période
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
