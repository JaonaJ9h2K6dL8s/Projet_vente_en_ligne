'use client';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/authStore';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  Button,
  LinearProgress,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import { useEffect, useState, useMemo } from 'react';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ProfitStat {
  productId: string;
  productName: string;
  variantId: string;
  variantSize: string;
  variantColor: string;
  quantitySold: number;
  revenue: number;
  purchasePrice: number;
  unitRevenue: number;
  unitMargin: number;
  totalCost: number;
  profit: number;
}

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('fr-FR')} MGA`;
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString('fr-FR');
}

export default function ProfitPage() {
  const theme = useTheme();
  const { selectedUserId } = useAuthStore();
  const [stats, setStats] = useState<ProfitStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchProfitStats = () => {
    if (!selectedUserId) return;
    setLoading(true);
    let url = `/api/profit?userId=${selectedUserId}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setStats(Array.isArray(data.stats) ? data.stats : []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfitStats();
  }, [selectedUserId, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return stats.reduce((acc, curr) => ({
      revenue: acc.revenue + curr.revenue,
      cost: acc.cost + curr.totalCost,
      profit: acc.profit + curr.profit,
    }), { revenue: 0, cost: 0, profit: 0 });
  }, [stats]);

  const handleExportPdfZip = async () => {
    if (stats.length === 0) return;
    setExporting(true);
    try {
      const doc = new jsPDF();
      doc.text("Rapport des Bénéfices", 14, 15);
      if (dateFrom || dateTo) {
        doc.setFontSize(10);
        doc.text(`Période : ${dateFrom || 'Début'} au ${dateTo || 'Aujourd\'hui'}`, 14, 22);
      }

      const tableData = stats.map(s => [
        s.productName,
        `${s.variantSize} / ${s.variantColor}`,
        formatQty(s.quantitySold),
        formatMoney(s.purchasePrice),
        formatMoney(s.unitRevenue),
        formatMoney(s.unitMargin),
        formatMoney(s.profit)
      ]);

      tableData.push([
        'TOTAL',
        '-',
        '-',
        '-',
        '-',
        '-',
        formatMoney(totals.profit)
      ]);

      (doc as any).autoTable({
        startY: 30,
        head: [['Produit', 'Variante', 'Qté', 'Prix Achat U.', 'Prix Revente U.', 'Marge U.', 'Bénéfice Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [211, 47, 47] },
        foot: [tableData[tableData.length - 1]],
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      const pdfBlob = doc.output('blob');

      const zip = new JSZip();
      zip.file(`Rapport_Benefices_${new Date().toISOString().split('T')[0]}.pdf`, pdfBlob);
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Export_Benefices_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Étude des Bénéfices" subtitle="Analyse de la rentabilité des produits" />

        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Stack spacing={3}>
            {/* Filters */}
            <Card sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 2 }}>
                <TextField
                  label="Date de début"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
                <TextField
                  label="Date de fin"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleExportPdfZip}
                  disabled={exporting || stats.length === 0}
                  startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadRoundedIcon />}
                  sx={{ borderRadius: 0, fontWeight: 800 }}
                >
                  {exporting ? 'Exportation...' : 'Exporter PDF (.zip)'}
                </Button>
              </CardContent>
            </Card>

            {/* Dashboard Cards */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 0, border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.2), bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2 }}>
                        <AccountBalanceWalletRoundedIcon color="success" fontSize="large" />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={700}>Chiffre d'Affaires</Typography>
                        <Typography variant="h5" fontWeight={900} color="success.main">{formatMoney(totals.revenue)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 0, border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.2), bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: 2 }}>
                        <MonetizationOnRoundedIcon color="error" fontSize="large" />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={700}>Coût d'Achat Total</Typography>
                        <Typography variant="h5" fontWeight={900} color="error.main">{formatMoney(totals.cost)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 0, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2), bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2 }}>
                        <TrendingUpRoundedIcon color="primary" fontSize="large" />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={700}>Bénéfice Net</Typography>
                        <Typography variant="h5" fontWeight={900} color="primary.main">{formatMoney(totals.profit)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {loading && <LinearProgress />}

            {/* Table */}
            <TableContainer component={Card} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.8) }}>
                    <TableCell sx={{ color: 'white', fontWeight: 800 }}>Produit</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 800 }}>Variante</TableCell>
                    <TableCell align="center" sx={{ color: 'white', fontWeight: 800 }}>Qté</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 800 }}>Prix Achat U.</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 800 }}>Prix Revente U.</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 800 }}>Marge U.</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 800 }}>Bénéfice Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{row.productName}</TableCell>
                      <TableCell>{row.variantSize} / {row.variantColor}</TableCell>
                      <TableCell align="center">{formatQty(row.quantitySold)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatMoney(row.purchasePrice)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatMoney(row.unitRevenue)}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{formatMoney(row.unitMargin)}</TableCell>
                      <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 900 }}>{formatMoney(row.profit)}</TableCell>
                    </TableRow>
                  ))}
                  {stats.length > 0 && (
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell colSpan={6} align="right" sx={{ fontWeight: 900, color: 'primary.main' }}>TOTAL BÉNÉFICE DES VENTES</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: 'primary.main', fontSize: '1.1rem' }}>{formatMoney(totals.profit)}</TableCell>
                    </TableRow>
                  )}
                  {stats.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>Aucune donnée de vente pour cette période.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
