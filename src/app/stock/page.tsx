'use client';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { useDebounce } from '@/hooks/useDebounce';
import type { Product, ProductVariant } from '@/types';
import {
    Add,
    AddCircleOutline,
    AutoDelete,
    Delete,
    Edit,
    Inventory,
    RemoveCircleOutline,
    Search,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card, CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    LinearProgress,
    CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import StockStatistics from './StockStatistics';
import { Tabs, Tab } from '@mui/material';

import JSZip from 'jszip';

interface VariantForm {
  id?: string;
  size: string;
  color: string;
  price: number;
  purchasePrice: number;
  stock: number;
  sku: string;
}

interface SpecialOfferDetails {
  id: string;
  productId: string;
  bundleQuantity: number;
  items: Array<{
    id: string;
    productName: string;
    variantSize: string;
    variantColor: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

const emptyVariant: VariantForm = { size: '', color: '', price: 0, purchasePrice: 0, stock: 0, sku: '' };

interface ProductRowProps {
  product: Product;
  totalStock: number;
  minPrice: number;
  variantCount: number;
  onEdit: (product: Product) => void;
  onViewSizes: (product: Product) => void;
  onDelete: (product: Product) => void;
}

const ProductRow = memo(function ProductRow({ product, totalStock, minPrice, variantCount, onEdit, onViewSizes, onDelete }: ProductRowProps) {
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
        <Chip label={variantCount} size="small" color="info" />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={totalStock}
          size="small"
          color={totalStock <= 5 ? (totalStock === 0 ? 'error' : 'warning') : 'success'}
        />
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight={600}>
          {minPrice.toLocaleString('fr-FR')} MGA
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Tooltip title="Tailles / stocks"><IconButton size="small" onClick={() => onViewSizes(product)}><Inventory fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Modifier"><IconButton size="small" onClick={() => onEdit(product)}><Edit fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Supprimer">
          <IconButton size="small" color="error" onClick={() => onDelete(product)}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

export default function ProductsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { user, selectedUserId, startDataLoading, endDataLoading, setDataError } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variants, setVariants] = useState<VariantForm[]>([{ ...emptyVariant }]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [sizeDialogProduct, setSizeDialogProduct] = useState<Product | null>(null);
  const [specialOfferByProductId, setSpecialOfferByProductId] = useState<Record<string, SpecialOfferDetails>>({});
  const [tabIndex, setTabIndex] = useState(0);

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    return fallback;
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!selectedUserId) return;
    setLoading(true);
    startDataLoading();
    try {
      const [productsRes, offersRes] = await Promise.all([
        fetch(`/api/products?search=${debouncedSearch}&category=${filterCategory}&page=${page + 1}&limit=${rowsPerPage}&userId=${selectedUserId}`),
        fetch(`/api/special-offers?mode=offers&userId=${selectedUserId}`),
      ]);
      const data = await productsRes.json();
      const offersData = await offersRes.json();
      if (!productsRes.ok || !offersRes.ok) {
        throw new Error(data?.error || offersData?.error || 'Erreur serveur');
      }
      setProducts(Array.isArray(data.products) ? data.products : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      const offers = Array.isArray(offersData.offers) ? (offersData.offers as SpecialOfferDetails[]) : [];
      const byProductId: Record<string, SpecialOfferDetails> = {};
      offers.forEach((offer) => {
        byProductId[offer.productId] = offer;
      });
      setSpecialOfferByProductId(byProductId);
      setDataError(null);
    } catch (error) {
      enqueueSnackbar('Erreur de chargement', { variant: 'error' });
      setDataError(getErrorMessage(error, 'Erreur chargement produits'));
    } finally {
      setLoading(false);
      endDataLoading();
    }
  }, [debouncedSearch, filterCategory, page, rowsPerPage, enqueueSnackbar, selectedUserId, startDataLoading, endDataLoading, setDataError, getErrorMessage]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => {
    setName(''); setDescription(''); setCategory(''); setImageUrl('');
    setVariants([{ ...emptyVariant }]); setEditingProduct(null);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name); setDescription(product.description); setCategory(product.category); setImageUrl(product.imageUrl || '');
    const pv = product.variants || [];
    setVariants(pv.length > 0
      ? pv.map((v: ProductVariant) => ({ id: v.id, size: v.size, color: v.color || '', price: v.price, purchasePrice: v.purchasePrice || 0, stock: v.stock, sku: v.sku }))
      : [{ ...emptyVariant }]);
    setDialogOpen(true);
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedUserId) {
      enqueueSnackbar('Veuillez sélectionner une entreprise', { variant: 'error' });
      return;
    }

    setImportLoading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = Object.values(zip.files).find(f => f.name.endsWith('.json'));
      
      if (!jsonFile) {
        throw new Error("Aucun fichier JSON trouvé dans le ZIP.");
      }

      const jsonContent = await jsonFile.async("string");
      const data = JSON.parse(jsonContent);

      if (!data.produits || !Array.isArray(data.produits)) {
         throw new Error("Format JSON invalide. Le champ 'produits' est manquant.");
      }

      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          username: user?.username,
          importData: data
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur lors de l'importation");

      enqueueSnackbar(result.message || "Importation réussie", { variant: 'success' });
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      enqueueSnackbar(err.message || "Erreur lors de l'importation", { variant: 'error' });
    } finally {
      setImportLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { enqueueSnackbar('Le nom est requis', { variant: 'warning' }); return; }
    if (!category.trim()) { enqueueSnackbar('La catégorie est requise', { variant: 'warning' }); return; }
    if (!selectedUserId) { enqueueSnackbar('Utilisateur requis', { variant: 'error' }); return; }
    const validVariants = variants.filter(v => v.size || v.sku || v.price > 0 || v.stock > 0);
    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { id: editingProduct.id, name, description, category, imageUrl, isActive: true, variants: validVariants, userId: selectedUserId, username: user?.username }
        : { name, description, category, imageUrl, variants: validVariants, userId: selectedUserId, username: user?.username };
      const res = await fetch('/api/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        enqueueSnackbar(editingProduct ? 'Produit modifié' : 'Produit ajouté', { variant: 'success' });
        setDialogOpen(false); resetForm(); fetchProducts();
      } else {
        const errorBody = await res.json().catch(() => null);
        enqueueSnackbar(errorBody?.error || 'Erreur lors de la sauvegarde', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' }); }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    if (!selectedUserId) { enqueueSnackbar('Utilisateur requis', { variant: 'error' }); return; }
    try {
      const res = await fetch(`/api/products?id=${productToDelete.id}&userId=${selectedUserId}&username=${encodeURIComponent(user?.username || '')}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.mode === 'archived') {
          enqueueSnackbar('Produit archivé et stock remis à 0 (commandes conservées)', { variant: 'success' });
        } else {
          enqueueSnackbar('Produit supprimé', { variant: 'success' });
        }
        setDeleteDialogOpen(false); setProductToDelete(null); fetchProducts();
      } else {
        const data = await res.json().catch(() => null);
        enqueueSnackbar(data?.error || 'Erreur lors de la suppression', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Erreur lors de la suppression', { variant: 'error' }); }
  };

  const handleCleanupStock = async () => {
    if (!selectedUserId) {
      enqueueSnackbar('Utilisateur requis', { variant: 'error' });
      return;
    }
    setCleanupLoading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cleanupStock',
          userId: selectedUserId,
          username: user?.username || '',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        enqueueSnackbar(data?.error || 'Erreur pendant le nettoyage', { variant: 'error' });
        return;
      }
      enqueueSnackbar(
        `Nettoyage terminé: ${data.deletedCount || 0} supprimés, ${data.archivedCount || 0} archivés`,
        { variant: 'success' }
      );
      setCleanupDialogOpen(false);
      fetchProducts();
    } catch {
      enqueueSnackbar('Erreur pendant le nettoyage', { variant: 'error' });
    } finally {
      setCleanupLoading(false);
    }
  };


  const addVariant = () => setVariants([...variants, { ...emptyVariant }]);
  const removeVariant = (index: number) => setVariants(variants.filter((_, i) => i !== index));
  const updateVariant = (index: number, field: keyof VariantForm, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

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
        <Header title="Gestion du Stock" subtitle={`${total} produits enregistrés`} />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 1, bgcolor: 'background.paper' }}>
          <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
            <Tab label="Liste des produits" />
            <Tab label="Statistiques" />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading && <LinearProgress />}
          
          {tabIndex === 0 && (
            <Box sx={{ p: 3 }}>
            {/* Actions Bar */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 2, '&:last-child': { pb: 2 } }}>
              <TextField placeholder="Rechercher un produit..." size="small" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
                sx={{ minWidth: 280 }}
              />
              <TextField
                size="small"
                label="Catégorie"
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                sx={{ minWidth: 180 }}
              />
              <Box sx={{ flex: 1 }} />
              <Button
                variant="outlined"
                color="warning"
                startIcon={<AutoDelete />}
                onClick={() => setCleanupDialogOpen(true)}
              >
                Nettoyer stock
              </Button>
              <Button
                  variant="contained"
                  component="label"
                  startIcon={importLoading ? <CircularProgress size={20} color="inherit" /> : <Add />}
                  disabled={importLoading}
                >
                  {importLoading ? 'Importation...' : 'Importer (.zip)'}
                  <input type="file" hidden accept=".zip" onChange={handleImportZip} />
                </Button>
              </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Produit</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="center">Tailles</TableCell>
                    <TableCell align="center">Stock total</TableCell>
                    <TableCell align="right">Prix à partir de</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => {
                    const stats = productStats.get(product.id) || { totalStock: 0, minPrice: 0, variantCount: 0 };
                    return (
                      <ProductRow
                        key={product.id}
                        product={product}
                        totalStock={stats.totalStock}
                        minPrice={stats.minPrice}
                        variantCount={stats.variantCount}
                        onEdit={openEdit}
                        onViewSizes={(p) => { setSizeDialogProduct(p); setSizeDialogOpen(true); }}
                        onDelete={(p) => { setProductToDelete(p); setDeleteDialogOpen(true); }}
                      />
                    );
                  })}
                  {products.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Inventory sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography color="text.secondary">Aucun produit trouvé</Typography>
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Lignes par page"
            />
          </Card>
          </Box>
          )}

          {tabIndex === 1 && <StockStatistics />}
        </Box>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Détail stock</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={8}>
                <TextField fullWidth label="Nom du produit" value={name} onChange={(e) => setName(e.target.value)} required disabled />
              </Grid>
              <Grid size={4}>
                <TextField fullWidth label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} required disabled />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} disabled />
              </Grid>

              {editingProduct && specialOfferByProductId[editingProduct.id] && (
                <Grid size={12}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Cette offre spéciale contient {specialOfferByProductId[editingProduct.id].bundleQuantity} articles au total.
                  </Alert>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Article du pack</TableCell>
                          <TableCell align="center">Qté</TableCell>
                          <TableCell align="right">P.U</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {specialOfferByProductId[editingProduct.id].items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.productName} ({item.variantSize} {item.variantColor})</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">{Number(item.unitPrice || 0).toLocaleString('fr-FR')} MGA</TableCell>
                            <TableCell align="right">{Number(item.totalPrice || 0).toLocaleString('fr-FR')} MGA</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}

              <Grid size={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Tailles du produit</Typography>
                </Box>

                {variants.map((variant, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
                    <TextField label="Taille" value={variant.size} onChange={(e) => updateVariant(index, 'size', e.target.value)} size="small" sx={{ flex: 1 }} disabled />
                    <TextField label="Couleur" value={variant.color} onChange={(e) => updateVariant(index, 'color', e.target.value)} size="small" sx={{ flex: 1 }} disabled />
                    <TextField label="Valeur Envoyée" type="number" value={variant.purchasePrice} size="small" sx={{ flex: 1 }} disabled />
                    <TextField label="Prix à revendre" type="number" value={variant.price} onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)} size="small" sx={{ flex: 1 }} />
                    <TextField label="Stock" type="number" value={variant.stock} onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)} size="small" sx={{ width: 90 }} disabled />
                    <TextField label="Code" value={variant.sku} onChange={(e) => updateVariant(index, 'sku', e.target.value)} size="small" sx={{ flex: 1 }} disabled />
                  </Box>
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button variant="contained" onClick={handleSave}>Modifier</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={sizeDialogOpen} onClose={() => setSizeDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Détails du produit</DialogTitle>
          <DialogContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Produit (Couleur) (Taille) (Code)</TableCell>
                  <TableCell align="right">Stock</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(sizeDialogProduct?.variants || []).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {sizeDialogProduct?.name} ({v.color || '-'}) ({v.size || '-'}) {v.sku ? `(${v.sku})` : ''}
                    </TableCell>
                    <TableCell align="right">{v.stock}</TableCell>
                  </TableRow>
                ))}
                {(!sizeDialogProduct?.variants || sizeDialogProduct.variants.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      <Typography color="text.secondary">Aucun détail disponible</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSizeDialogOpen(false)}>Fermer</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Retirer ce produit du stock</DialogTitle>
          <DialogContent>
            <Typography>
              Le produit <strong>{productToDelete?.name}</strong> sera retiré du stock. S&apos;il existe dans des commandes déjà passées,
              il sera archivé automatiquement avec stock à 0 pour conserver l&apos;historique des ventes et des lives.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="contained" color="warning" onClick={handleDelete}>Retirer du stock</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={cleanupDialogOpen} onClose={() => !cleanupLoading && setCleanupDialogOpen(false)}>
          <DialogTitle>Nettoyer le stock</DialogTitle>
          <DialogContent>
            <Typography>
              Cette action supprime les produits non utilisés, archive automatiquement les produits liés à des commandes
              et met leur stock à 0. Les produits archivés ne s&apos;affichent plus dans les écrans de vente.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button disabled={cleanupLoading} onClick={() => setCleanupDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              color="warning"
              disabled={cleanupLoading}
              onClick={handleCleanupStock}
            >
              {cleanupLoading ? 'Nettoyage...' : 'Confirmer'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
