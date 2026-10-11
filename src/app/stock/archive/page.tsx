'use client';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/stores/authStore';
import type { Product } from '@/types';
import { Inventory, Search } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function StockArchivePage() {
  const { enqueueSnackbar } = useSnackbar();
  const { selectedUserId, startDataLoading, endDataLoading, setDataError } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    return fallback;
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!selectedUserId) return;
    setLoading(true);
    startDataLoading();
    try {
      const res = await fetch(
        `/api/products?archivedOnly=1&search=${debouncedSearch}&category=${filterCategory}&page=${page + 1}&limit=${rowsPerPage}&userId=${selectedUserId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      setProducts(Array.isArray(data.products) ? data.products : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setDataError(null);
    } catch (error) {
      enqueueSnackbar('Erreur de chargement des archives', { variant: 'error' });
      setDataError(getErrorMessage(error, 'Erreur chargement archives stock'));
    } finally {
      setLoading(false);
      endDataLoading();
    }
  }, [debouncedSearch, filterCategory, page, rowsPerPage, selectedUserId, startDataLoading, endDataLoading, setDataError, enqueueSnackbar, getErrorMessage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const productStats = useMemo(() => {
    const map = new Map<string, { totalStock: number; minPrice: number; variantCount: number }>();
    for (const product of products) {
      const variants = product.variants || [];
      let totalStock = 0;
      let minPrice = 0;
      if (variants.length > 0) {
        minPrice = variants[0].price || 0;
        for (const v of variants) {
          totalStock += v.stock;
          if (v.price < minPrice) minPrice = v.price;
        }
      }
      map.set(product.id, { totalStock, minPrice, variantCount: variants.length });
    }
    return map;
  }, [products]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Archive du stock" subtitle={`${total} produits archivés`} />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading && <LinearProgress />}
          <Box sx={{ p: 3 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                <TextField
                  placeholder="Rechercher un produit archivé..."
                  size="small"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
                  sx={{ minWidth: 320 }}
                />
                <TextField
                  size="small"
                  label="Catégorie"
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPage(0);
                  }}
                  sx={{ minWidth: 180 }}
                />
              </CardContent>
            </Card>

            <Card>
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Produit archivé</TableCell>
                      <TableCell>Catégorie</TableCell>
                      <TableCell align="center">Tailles</TableCell>
                      <TableCell align="center">Stock total</TableCell>
                      <TableCell align="right">Prix à partir de</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((product) => {
                      const stats = productStats.get(product.id) || { totalStock: 0, minPrice: 0, variantCount: 0 };
                      return (
                        <TableRow key={product.id} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{product.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{product.description || 'Pas de description'}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {product.category ? <Chip label={product.category} size="small" variant="outlined" /> : '-'}
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={stats.variantCount} size="small" color="info" />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={stats.totalStock} size="small" color={stats.totalStock === 0 ? 'error' : 'warning'} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>
                              {stats.minPrice.toLocaleString('fr-FR')} MGA
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {products.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                          <Inventory sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography color="text.secondary">Aucun produit archivé</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Lignes par page"
              />
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
