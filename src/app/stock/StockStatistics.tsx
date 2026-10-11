'use client';

import { useAuthStore } from '@/stores/authStore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { Fragment, useEffect, useMemo, useState } from 'react';

interface VariantStats {
  variantId: string;
  variantSize: string;
  variantColor: string;
  variantCodes: string;
  initialQuantity: number;
  initialPurchaseValue: number;
  initialResaleValue: number;
  currentStock: number;
  currentStockValue: number;
  currentStockPurchaseValue: number;
  soldQuantity: number;
  soldValue: number;
  soldCodes: string[];
  pendingQuantity: number;
  pendingValue: number;
  pendingCodes: string[];
}

interface ProductStats {
  productId: string;
  productName: string;
  initialQuantity: number;
  initialPurchaseValue: number;
  initialResaleValue: number;
  currentStock: number;
  currentStockValue: number;
  currentStockPurchaseValue: number;
  soldQuantity: number;
  soldValue: number;
  pendingQuantity: number;
  pendingValue: number;
  variants?: VariantStats[];
}

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('fr-FR')} MGA`;
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 0,
        border: '1px solid',
        borderColor: alpha(color, 0.22),
        background: `linear-gradient(135deg, ${alpha(color, 0.18)} 0%, rgba(255,255,255,0.98) 70%)`,
        boxShadow: `0 14px 32px ${alpha(color, 0.16)}`,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.15 }}>
              {value}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
              {subtitle}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 3,
              bgcolor: alpha(color, 0.14),
              color,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function CodeGroup({
  title,
  codes,
  emptyLabel,
  color,
  variant,
}: {
  title: string;
  codes: string[];
  emptyLabel: string;
  color: 'primary' | 'success' | 'warning';
  variant?: 'filled' | 'outlined';
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 0,
        bgcolor: (theme) => alpha(theme.palette[color].main, 0.06),
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette[color].main, 0.16),
        minHeight: 84,
      }}
    >
      <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 800, color: 'text.secondary' }}>
        {title}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {codes.length > 0 ? (
          codes.map((code, index) => (
            <Chip
              key={`${title}-${index}-${code}`}
              label={code}
              size="small"
              color={color}
              variant={variant || 'filled'}
              sx={{ fontWeight: 700, borderRadius: 0 }}
            />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function Row({ row, forceExpandAll }: { row: ProductStats, forceExpandAll?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isActuallyOpen = forceExpandAll || open;
  const variants = row.variants || [];
  const stockState =
    row.currentStock === 0 ? 'Rupture' : row.currentStock <= 3 ? 'Stock faible' : 'Disponible';
  const stockColor =
    row.currentStock === 0 ? 'error' : row.currentStock <= 3 ? 'warning' : 'success';

  return (
    <Fragment>
      <TableRow
        hover
        sx={{
          '& > *': { borderBottom: 'unset' },
          bgcolor: isActuallyOpen ? alpha(theme.palette.primary.main, 0.015) : 'transparent',
          transition: 'background-color 0.2s ease',
        }}
      >
        <TableCell sx={{ width: 48, borderRight: '1px solid', borderColor: 'divider' }}>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: isActuallyOpen ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
            }}
          >
            {isActuallyOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {row.productName}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              <Chip
                label={`${variants.length} variante${variants.length > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', borderRadius: 0 }}    
              />
              <Chip label={stockState} size="small" color={stockColor} sx={{ height: 20, fontSize: '0.7rem', borderRadius: 0, '& .MuiChip-label': { color: '#ffffff' } }} />
            </Stack>
          </Stack>
        </TableCell>
        <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700, color: 'secondary.main', fontSize: '0.875rem' }}>
            {formatMoney(row.initialPurchaseValue)}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Chip label={formatQty(row.initialQuantity)} color="secondary" variant="outlined" sx={{ fontWeight: 700, height: 22, borderRadius: 0 }} />
        </TableCell>
        <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.875rem' }}>
            {formatMoney(row.currentStockValue)}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Chip label={formatQty(row.currentStock)} color="primary" variant="outlined" sx={{ fontWeight: 700, height: 22, borderRadius: 0 }} />
        </TableCell>
        <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.875rem' }}>
            {formatMoney(row.soldValue)}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Chip label={formatQty(row.soldQuantity)} color="success" sx={{ fontWeight: 700, height: 22, borderRadius: 0, '& .MuiChip-label': { color: '#ffffff' } }} />
        </TableCell>
        <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700, color: 'warning.dark', fontSize: '0.875rem' }}>
            {formatMoney(row.pendingValue)}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Chip label={formatQty(row.pendingQuantity)} color="warning" sx={{ fontWeight: 700, height: 22, borderRadius: 0, '& .MuiChip-label': { color: '#ffffff' } }} />
        </TableCell>
        <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700, color: 'error.main', fontSize: '0.875rem' }}>
            {formatMoney(row.currentStockValue)}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip label={formatQty(row.currentStock)} color="error" sx={{ fontWeight: 700, height: 22, borderRadius: 0, '& .MuiChip-label': { color: '#ffffff' } }} />
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell sx={{ py: 0, borderBottom: `1px solid ${theme.palette.divider}` }} colSpan={11}>
          <Collapse in={isActuallyOpen} timeout="auto" unmountOnExit>
            <Box
              sx={{
                px: 2.5,
                py: 2.25,
                bgcolor: alpha(theme.palette.info.main, 0.12),
                borderTop: '1px solid',
                borderColor: alpha(theme.palette.info.main, 0.2),
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Détail intelligent des variantes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vous voyez ici les codes encore en stock, déjà vendus et actuellement en attente.
                  </Typography>
                </Box>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={`Stock: ${formatQty(row.currentStock)}`} color="primary" variant="outlined" />
                  <Chip label={`Vendu: ${formatQty(row.soldQuantity)}`} color="success" variant="outlined" />
                  <Chip label={`En attente: ${formatQty(row.pendingQuantity)}`} color="info" variant="outlined" />
                </Stack>
              </Stack>

              {variants.length === 0 ? (
                <Alert severity="info">Aucune variante disponible pour ce produit.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {variants.map((variant) => {
                    const importedCodes = variant.variantCodes
                      ? variant.variantCodes
                          .split('|')
                          .map((code) => code.trim())
                          .filter(Boolean)
                      : [];
                    const soldCodes = variant.soldCodes || [];
                    const pendingCodes = variant.pendingCodes || [];
                    const soldSet = new Set(soldCodes);
                    const pendingSet = new Set(pendingCodes);
                    const remainingCodes = importedCodes.filter(
                      (code) => !soldSet.has(code) && !pendingSet.has(code)
                    );

                    return (
                      <Grid item xs={12} key={variant.variantId}>
                        <Card
                          sx={{
                            borderRadius: 0,
                            border: '1px solid',
                            borderColor: alpha(theme.palette.primary.main, 0.1),
                            boxShadow: 'none',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              px: 2,
                              py: 1.5,
                              background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                            }}
                          >
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                            >
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                  {row.productName} - {variant.variantSize} / {variant.variantColor}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Valeur en stock: {formatMoney(variant.currentStockValue)}
                                </Typography>
                              </Box>
                              <Stack direction="row" gap={1} flexWrap="wrap">
                                <Chip 
                                  label={`Stock: ${formatQty(variant.currentStock)}`} 
                                  color="primary" 
                                  size="small" 
                                  sx={{ fontWeight: 700 }} 
                                />
                                <Chip 
                                  label={`Vendu: ${formatQty(variant.soldQuantity)}`} 
                                  color="success" 
                                  size="small" 
                                  sx={{ fontWeight: 800, px: 1 }} 
                                />
                                <Chip 
                                  label={`Attente: ${formatQty(variant.pendingQuantity)}`} 
                                  color="info" 
                                  size="small" 
                                  sx={{ fontWeight: 700 }} 
                                />
                              </Stack>
                            </Stack>
                          </Box>

                          <CardContent sx={{ p: 2 }}>
                            <Grid container spacing={1.5}>
                              <Grid item xs={12} md={3}>
                                <CodeGroup
                                  title="Codes encore en stock"
                                  codes={importedCodes}
                                  emptyLabel="Aucun code importé"
                                  color="primary"
                                  variant="outlined"
                                />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <CodeGroup
                                  title="Codes déjà vendus"
                                  codes={soldCodes}
                                  emptyLabel={variant.soldQuantity > 0 ? `${variant.soldQuantity} vendu(s) (sans code)` : "Aucune vente"}
                                  color="success"
                                />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <CodeGroup
                                  title="Codes en attente"
                                  codes={pendingCodes}
                                  emptyLabel={variant.pendingQuantity > 0 ? `${variant.pendingQuantity} en attente (sans code)` : "Aucune réservation"}
                                  color="warning"
                                />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <CodeGroup
                                  title="Codes non vendus"
                                  codes={remainingCodes}
                                  emptyLabel="Aucun reste"
                                  color="error"
                                  variant="outlined"
                                />
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

export default function StockStatistics() {
  const { user, selectedUserId } = useAuthStore();
  const theme = useTheme();
  const [stats, setStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [forceExpandAll, setForceExpandAll] = useState(false);

  useEffect(() => {
    if (!selectedUserId) return;

    setLoading(true);
    fetch(`/api/stock/statistics?userId=${selectedUserId}`)
      .then((res) => res.json())
      .then((data) => {
        setStats(Array.isArray(data.stats) ? data.stats : []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedUserId]);

  const totals = useMemo(() => {
    return stats.reduce(
      (acc, curr) => ({
        initialQuantity: acc.initialQuantity + Number(curr.initialQuantity || 0),
        initialPurchaseValue: acc.initialPurchaseValue + Number(curr.initialPurchaseValue || 0),
        initialResaleValue: acc.initialResaleValue + Number(curr.initialResaleValue || 0),
        currentStock: acc.currentStock + Number(curr.currentStock || 0),
        currentStockValue: acc.currentStockValue + Number(curr.currentStockValue || 0),
        currentStockPurchaseValue: acc.currentStockPurchaseValue + Number(curr.currentStockPurchaseValue || 0),
        soldQuantity: acc.soldQuantity + Number(curr.soldQuantity || 0),
        soldValue: acc.soldValue + Number(curr.soldValue || 0),
        pendingQuantity: acc.pendingQuantity + Number(curr.pendingQuantity || 0),
        pendingValue: acc.pendingValue + Number(curr.pendingValue || 0),
      }),
      {
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
      }
    );
  }, [stats]);

  const handleExportZip = async () => {
    if (stats.length === 0) return;
    setExporting(true);
    setForceExpandAll(true);
    
    // Attendre que l'animation d'ouverture des détails se termine
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const zip = new JSZip();
      
      // Prepare detailed data for export
      const exportData = {
        dateExport: new Date().toISOString(),
        resumeGlobal: {
          valeurEnvoyee: totals.initialPurchaseValue,
          quantiteEnvoyee: totals.initialQuantity,
          quantiteStock: totals.currentStock,
          valeurVendue: totals.soldValue,
          quantiteVendue: totals.soldQuantity,
          valeurEnAttente: totals.pendingValue,
          quantiteEnAttente: totals.pendingQuantity,
          quantiteNonVendue: totals.currentStock,
        },
        produits: stats.map(p => ({
          nom: p.productName,
          valeurEnvoyee: p.initialPurchaseValue,
          quantiteEnvoyee: p.initialQuantity,
          quantiteStock: p.currentStock,
          valeurVendue: p.soldValue,
          quantiteVendue: p.soldQuantity,
          valeurEnAttente: p.pendingValue,
          quantiteEnAttente: p.pendingQuantity,
          variantes: (p.variants || []).map(v => {
            const importedCodes = v.variantCodes
              ? v.variantCodes.split('|').map(c => c.trim()).filter(Boolean)
              : [];
            const soldCodes = v.soldCodes || [];
            const pendingCodes = v.pendingCodes || [];
            const soldSet = new Set(soldCodes);
            const pendingSet = new Set(pendingCodes);
            const nonSoldCodes = importedCodes.filter(c => !soldSet.has(c) && !pendingSet.has(c));

            return {
              taille: v.variantSize,
              couleur: v.variantColor,
              quantiteStock: v.currentStock,
              quantiteVendue: v.soldQuantity,
              quantiteEnAttente: v.pendingQuantity,
              codesImportes: importedCodes,
              codesVendus: soldCodes,
              codesEnAttente: pendingCodes,
              codesNonVendus: nonSoldCodes
            };
          })
        }))
      };

      const fileName = `Export_Statistiques_Stock_${new Date().toISOString().split('T')[0]}.json`;
      zip.file(fileName, JSON.stringify(exportData, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Export_Statistiques_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setForceExpandAll(false);
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (stats.length === 0) return;
    setExporting(true);
    setForceExpandAll(true);

    // Attendre que l'animation d'ouverture des détails se termine
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const zip = new JSZip();

      // Generation du PDF via capture de l'interface
      const element = document.getElementById('statistics-table-container');
      if (element) {
        // Optionnel: On peut forcer une largeur fixe temporairement pour éviter des problèmes de responsivité
        const canvas = await html2canvas(element, {
          scale: 2, // Pour une meilleure qualité
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');

        // Dimensions du canvas
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Créer un PDF format A4 paysage
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth(); // 297 mm
        const pdfHeight = pdf.internal.pageSize.getHeight(); // 210 mm
        
        // Calculer les dimensions de l'image pour l'adapter à la largeur de la page A4
        const imgWidth = pdfWidth;
        const imgHeight = (canvasHeight * pdfWidth) / canvasWidth;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Ajouter la première page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Ajouter des pages supplémentaires si le tableau est long
        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        const pdfBlob = pdf.output('blob');
        zip.file(`Rapport_Statistiques_Visuel_${new Date().toISOString().split('T')[0]}.pdf`, pdfBlob);
      } else {
        // Fallback si l'élément n'est pas trouvé
        const doc = new jsPDF('landscape');
        doc.text("Erreur lors de la capture de l'interface", 14, 15);
        zip.file(`Rapport_Statistiques_Erreur_${new Date().toISOString().split('T')[0]}.pdf`, doc.output('blob'));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Rapport_PDF_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error('Export PDF error:', error);
    } finally {
      setForceExpandAll(false);
      setExporting(false);
    }
  };

  const productCount = stats.length;
  const alertLevel =
    totals.pendingQuantity > 0
      ? `${formatQty(totals.pendingQuantity)} article(s) sont encore en attente dans les commandes.`
      : 'Aucune quantité en attente pour le moment.';

  if (loading) return <LinearProgress />;

  return (
    <Box
      sx={{
        p: 3,
        background: `linear-gradient(180deg, ${alpha(theme.palette.info.main, 0.08)} 0%, rgba(255,255,255,0) 28%)`,
        minHeight: '100%',
      }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.75 }}>
            Tableau de bord du stock
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Une lecture claire du stock disponible, des ventes confirmées et des produits encore en attente.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6} xl={2.4}>
            <StatCard
              title="Valeur actuelle"
              value={formatMoney(totals.currentStockValue)}
              subtitle={`${productCount} produits suivis`}
              color={theme.palette.primary.main}
              icon={<MonetizationOnRoundedIcon />}
            />
          </Grid>
          <Grid item xs={12} md={6} xl={2.4}>
            <StatCard
              title="Qté disponible"
              value={formatQty(totals.currentStock)}
              subtitle="Articles en stock"
              color={theme.palette.info.main}
              icon={<Inventory2RoundedIcon />}
            />
          </Grid>
          <Grid item xs={12} md={6} xl={2.4}>
            <StatCard
              title="Total déjà vendu"
              value={formatMoney(totals.soldValue)}
              subtitle={`${formatQty(totals.soldQuantity)} articles vendus`}
              color={theme.palette.success.main}
              icon={<ShoppingBagRoundedIcon />}
            />
          </Grid>
          <Grid item xs={12} md={6} xl={2.4}>
            <StatCard
              title="Total en attente"
              value={formatMoney(totals.pendingValue)}
              subtitle={`${formatQty(totals.pendingQuantity)} articles réservés`}
              color={theme.palette.warning.main}
              icon={<PendingActionsRoundedIcon />}
            />
          </Grid>
          <Grid item xs={12} md={6} xl={2.4}>
            <StatCard
              title="Total Non Vendu"
              value={formatMoney(totals.currentStockValue)}
              subtitle={`${formatQty(totals.currentStock)} articles restants`}
              color={theme.palette.error.main}
              icon={<Inventory2RoundedIcon />}
            />
          </Grid>
        </Grid>

        <Alert
          severity={totals.pendingQuantity > 0 ? 'warning' : 'success'}
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor:
              totals.pendingQuantity > 0
                ? alpha(theme.palette.warning.main, 0.22)
                : alpha(theme.palette.success.main, 0.22),
          }}
        >
          {alertLevel}
        </Alert>

        <Card
          sx={{
            borderRadius: 0,
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.1),
            boxShadow: `0 18px 40px ${alpha(theme.palette.common.black, 0.06)}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2,
              background: `linear-gradient(135deg, #d32f2f 0%, #f44336 100%)`,
              color: 'common.white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '0.02em' }}>
                Statistiques détaillées par produit
              </Typography>
              <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.9), mt: 0.25, fontWeight: 500 }}>
                Cliquez sur une ligne pour afficher les codes restants, vendus et en attente.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                size="small"
                onClick={handleExportPdf}
                disabled={exporting || stats.length === 0}
                startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadRoundedIcon />}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 0,
                  fontWeight: 800,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                {exporting ? 'Exportation...' : 'Exporter PDF (.zip)'}
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleExportZip}
                disabled={exporting || stats.length === 0}
                startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadRoundedIcon />}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 0,
                  fontWeight: 800,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                {exporting ? 'Exportation...' : 'Exporter JSON (.zip)'}
              </Button>
              <Inventory2RoundedIcon sx={{ fontSize: 32, opacity: 0.3 }} />
            </Stack>
          </Box>

        <TableContainer id="statistics-table-container" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0, overflow: 'hidden' }}>
          <Table stickyHeader aria-label="tableau moderne des statistiques de stock">
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: alpha(theme.palette.info.main, 0.08), borderRight: '1px solid', borderColor: 'divider', width: 48 }} />
                <TableCell sx={{ bgcolor: alpha(theme.palette.info.main, 0.08), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}>
                  Produit
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Valeur Envoyée (Achat)
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Qté Envoyée
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Valeur en stock (Revente)
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ bgcolor: alpha(theme.palette.success.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Valeur vendue
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ bgcolor: alpha(theme.palette.success.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Qté vendue
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ bgcolor: alpha(theme.palette.warning.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Valeur attente
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ bgcolor: alpha(theme.palette.warning.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Qté attente
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.03), fontWeight: 800, borderRight: '1px solid', borderColor: 'divider' }}
                >
                  Valeur Non Vendu
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.03), fontWeight: 800 }}
                >
                  Qté Non vendue
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.map((row) => (
                <Row key={row.productId} row={row} forceExpandAll={forceExpandAll} />
              ))}

              {stats.length > 0 && (
                <TableRow
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.04),
                    '& td': { borderTop: `2px solid ${alpha(theme.palette.primary.main, 0.1)}` },
                  }}
                >
                  <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }} />
                  <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 900 }}>TOTAL GLOBAL</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 900, color: 'secondary.main' }}>
                      {formatMoney(totals.initialPurchaseValue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Chip label={formatQty(totals.initialQuantity)} color="secondary" sx={{ fontWeight: 900, height: 24 }} />
                  </TableCell>
                  <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 900, color: 'primary.main' }}>
                      {formatMoney(totals.currentStockValue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Chip label={formatQty(totals.currentStock)} color="primary" sx={{ fontWeight: 900, height: 24 }} />
                  </TableCell>
                  <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 900, color: 'success.main' }}>
                      {formatMoney(totals.soldValue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Chip label={formatQty(totals.soldQuantity)} color="success" sx={{ fontWeight: 900, height: 24, borderRadius: 1, '& .MuiChip-label': { color: '#ffffff' } }} />
                  </TableCell>
                  <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 900, color: 'warning.dark' }}>
                      {formatMoney(totals.pendingValue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Chip label={formatQty(totals.pendingQuantity)} color="warning" sx={{ fontWeight: 900, height: 24, borderRadius: 1, '& .MuiChip-label': { color: '#ffffff' } }} />
                  </TableCell>
                  <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 900, color: 'error.main' }}>
                      {formatMoney(totals.currentStockValue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={formatQty(totals.currentStock)} color="error" sx={{ fontWeight: 900, height: 24, borderRadius: 1, '& .MuiChip-label': { color: '#ffffff' } }} />
                  </TableCell>
                </TableRow>
              )}

                {stats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 7 }}>
                      <Stack spacing={1} alignItems="center">
                        <Inventory2RoundedIcon color="disabled" sx={{ fontSize: 42 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Aucune statistique disponible
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Importez ou ajoutez des produits pour voir apparaître le tableau moderne.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Divider />
      </Stack>
    </Box>
  );
}
