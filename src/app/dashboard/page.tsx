'use client';

import StatCard from '@/components/common/StatCard';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import type { DashboardStats } from '@/types';
import {
    AttachMoney,
    Inventory,
    People,
    ShoppingCart,
    TrendingUp,
    Warning,
} from '@mui/icons-material';
import { Box, Card, CardContent, Chip, Grid, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuthStore } from '@/stores/authStore';

const PIE_COLORS = ['#22C55E', '#F59E0B', '#3B82F6', '#EF4444'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedUserId, hasHydrated, startDataLoading, endDataLoading, setDataError } = useAuthStore();

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    return fallback;
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      if (!hasHydrated) return;
      if (!selectedUserId || typeof selectedUserId !== 'string' || selectedUserId.trim() === '') {
        setLoading(false);
        return;
      }
      startDataLoading();
      const res = await fetch(`/api/stats?type=dashboard&userId=${encodeURIComponent(selectedUserId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Erreur serveur (${res.status})`);
      }
      setStats(data);
      setDataError(null);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setDataError(getErrorMessage(error, 'Erreur chargement dashboard'));
    } finally {
      setLoading(false);
      endDataLoading();
    }
  }, [selectedUserId, hasHydrated, startDataLoading, endDataLoading, setDataError, getErrorMessage]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Tableau de bord" subtitle="Vue d'ensemble de votre activité" />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading && <LinearProgress />}
          <Box sx={{ p: 3 }}>
          {/* Stat Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Total Commandes"
                value={stats?.totalOrdersCount || 0}
                icon={<ShoppingCart />}
                color="#2E7D6F"
                bgColor="#E8F5F1"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Chiffre d'affaires Total"
                value={`${(stats?.expectedRevenue || 0).toLocaleString('fr-FR')} MGA`}
                icon={<AttachMoney />}
                color="#FF6B35"
                bgColor="#FFF3ED"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="CA Mensuel"
                value={`${(stats?.monthlyRevenue || 0).toLocaleString('fr-FR')} MGA`}
                icon={<TrendingUp />}
                color="#3B82F6"
                bgColor="#EFF6FF"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Total Clients"
                value={stats?.totalClients || 0}
                icon={<People />}
                color="#8B5CF6"
                bgColor="#F3F0FF"
              />
            </Grid>
          </Grid>

          {/* Charts Row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Revenue Chart */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Revenus des 30 derniers jours
                  </Typography>
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.revenueByDay || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(val: string) => {
                              const d = new Date(val);
                              return `${d.getDate()}/${d.getMonth() + 1}`;
                            }}
                        />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(val: number) => `${(val / 1000).toFixed(0)}k`} />
                        <Tooltip
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [`${Number(value).toLocaleString('fr-FR')} MGA`, 'Revenus']}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            labelFormatter={(label: any) => new Date(String(label)).toLocaleDateString('fr-FR')}
                        />
                        <Bar dataKey="revenue" fill="#2E7D6F" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Orders by Status Pie */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Commandes par statut
                  </Typography>
                  <Box sx={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {stats?.ordersByStatus && stats.ordersByStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.ordersByStatus}
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              innerRadius={50}
                              dataKey="count"
                              nameKey="status"
                              label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${value ?? 0}`}
                            >
                              {stats.ordersByStatus.map((_: unknown, index: number) => (
                                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                    ) : (
                      <Typography color="text.secondary">Aucune donnée</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Bottom Row */}
          <Grid container spacing={3}>
            {/* Top Products */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Inventory color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Produits les plus vendus
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Produit</TableCell>
                          <TableCell align="center">Vendus</TableCell>
                          <TableCell align="right">Revenus</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(stats?.topProducts || []).map((product, i) => (
                          <TableRow key={i} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{product.productName}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={product.totalSold} size="small" color="primary" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>
                                {product.revenue.toLocaleString('fr-FR')} MGA
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!stats?.topProducts || stats.topProducts.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography color="text.secondary" variant="body2">Aucune vente enregistrée</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Low Stock Alerts */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Warning color="warning" />
                    <Typography variant="h6" fontWeight={600}>
                      Alertes rupture de stock
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Produit</TableCell>
                          <TableCell>Variante</TableCell>
                          <TableCell align="center">Stock</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(stats?.lowStockProducts || []).map((product, i) => (
                          <TableRow key={i} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{product.productName}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">{product.variantInfo}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={product.stock}
                                size="small"
                                color={product.stock === 0 ? 'error' : 'warning'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!stats?.lowStockProducts || stats.lowStockProducts.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography color="text.secondary" variant="body2">Tous les stocks sont OK</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
