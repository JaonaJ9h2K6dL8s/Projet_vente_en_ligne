'use client';

import StatCard from '@/components/common/StatCard';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { exportFinanceReport } from '@/lib/pdf';
import type { Order } from '@/types';
import {
  AttachMoney,
  CalendarMonth,
  CheckCircle,
  Download,
  Inventory,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  TableFooter,
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
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

type ConfirmItem = {
  id: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
};

type ConfirmOrder = {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone: string;
  deliveryDate: string;
  shippingAddress: string;
  status: Order['status'];
  paymentMethod: Order['paymentMethod'];
  paymentReference: string;
  items: ConfirmItem[];
  paidAmount: number;
};

export default function DeliveryDailyStatsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { selectedUserId, startDataLoading, endDataLoading, setDataError } = useAuthStore();
  const company = useThemeStore((state) => state.company);
  const companyName = company.name || 'Entreprise';
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableDeliverers, setAvailableDeliverers] = useState<string[]>([]);

  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [dateFrom, setDateFrom] = useState(getToday);
  const [dateTo, setDateTo] = useState(getToday);
  const [deliveryPersonFilter, setDeliveryPersonFilter] = useState('');
  const [realizedStatusFilter, setRealizedStatusFilter] = useState<'delivered' | 'confirmed'>('delivered');
  const [clientSearch, setClientSearch] = useState('');
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRows, setConfirmRows] = useState<ConfirmOrder[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const exportJpgRef = useRef<HTMLDivElement>(null);
  const [isExportingJpg, setIsExportingJpg] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const handleExportConfirmJpg = async () => {
    if (!exportJpgRef.current) return;
    setIsExportingJpg(true);
    try {
      const canvas = await html2canvas(exportJpgRef.current, {
        scale: 1,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.download = `Statistiques_Livraison_${formatDate(dateFrom)}.jpg`;
      link.href = imgData;
      link.click();
      enqueueSnackbar('Image générée avec succès', { variant: 'success' });
    } catch (err) {
      console.error('Erreur export JPG:', err);
      enqueueSnackbar('Erreur lors de la génération de l\'image', { variant: 'error' });
    } finally {
      setIsExportingJpg(false);
    }
  };

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    return fallback;
  }, []);

  const fetchDeliverers = useCallback(async () => {
    if (!selectedUserId) return;
    try {
      const res = await fetch(`/api/orders?userId=${selectedUserId}&limit=1000`);
      const data = await res.json();
      if (data.orders) {
        const deliverers = new Set<string>();
        data.orders.forEach((o: Order) => {
          if (o.deliveryPerson) {
            deliverers.add(o.deliveryPerson.trim().toUpperCase());
          }
        });
        setAvailableDeliverers(Array.from(deliverers).sort());
      }
    } catch (error) {
      console.error('Error fetching deliverers:', error);
    }
  }, [selectedUserId]);

  const fetchFinanceData = useCallback(async () => {
    if (!selectedUserId) return;
    setLoading(true);
    startDataLoading();
    try {
      let url = `/api/orders?deliveryDateFrom=${dateFrom}&deliveryDateTo=${dateTo}&limit=1000&userId=${selectedUserId}`;
      if (deliveryPersonFilter) {
        url += `&deliveryPerson=${encodeURIComponent(deliveryPersonFilter)}`;
      }
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erreur chargement');

      setOrders(data.orders || []);
      setDataError(null);
    } catch (error) {
      enqueueSnackbar('Erreur de chargement des données financières', { variant: 'error' });
      setDataError(getErrorMessage(error, 'Erreur chargement finance'));
    } finally {
      setLoading(false);
      endDataLoading();
    }
  }, [dateFrom, dateTo, deliveryPersonFilter, selectedUserId, enqueueSnackbar, startDataLoading, endDataLoading, setDataError, getErrorMessage]);

  useEffect(() => {
    fetchDeliverers();
  }, [fetchDeliverers]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const stats = orders.reduce(
    (acc, order) => {
      acc.count++;
      if (order.status !== 'cancelled') {
        acc.expectedRevenue += order.totalAmount;
        if (order.status === realizedStatusFilter) {
          acc.realizedRevenue += order.totalAmount;
        } else if (order.status === 'pending' || order.status === 'confirmed') {
          acc.pendingCount++;
        }
        if (order.status === 'delivered') {
          acc.deliveredCount++;
          acc.deliveredItems += (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
        }
      }
      return acc;
    },
    { count: 0, expectedRevenue: 0, realizedRevenue: 0, deliveredCount: 0, pendingCount: 0, deliveredItems: 0 }
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');
  const formatMoney = (amount: number) => amount.toLocaleString('fr-FR').replace(/\s/g, '.');

  const getStatusLabel = (status: Order['status']) => {
    if (status === 'delivered') return 'Livrée';
    if (status === 'cancelled') return 'Annulée';
    if (status === 'paid') return 'Payée';
    if (status === 'pending') return 'En attente';
    if (status === 'confirmed') return 'Confirmée';
    return status;
  };
  const getPaymentLabel = (method: Order['paymentMethod']) => {
    if (method === 'mvola') return 'MVola';
    if (method === 'orange_money') return 'Orange Money';
    if (method === 'airtel_money') return 'Airtel Money';
    if (method === 'espece') return 'Espèce';
    return method || '-';
  };

  const handleUpdateOrderStatus = useCallback(async (order: Order, nextStatus: Order['status']) => {
    if (!selectedUserId || order.status === nextStatus) return;
    const previousOrders = orders;
    setUpdatingOrderId(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          userId: selectedUserId,
          status: nextStatus,
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          deliveryPerson: order.deliveryPerson,
          notes: order.notes,
          shippingAddress: order.shippingAddress,
          deliveryDate: order.deliveryDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur mise à jour statut');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
      enqueueSnackbar('Statut de commande mis à jour', { variant: 'success' });
    } catch (error) {
      setOrders(previousOrders);
      enqueueSnackbar(getErrorMessage(error, 'Erreur mise à jour statut'), { variant: 'error' });
    } finally {
      setUpdatingOrderId(null);
    }
  }, [selectedUserId, orders, enqueueSnackbar, getErrorMessage]);

  const buildConfirmRows = useCallback(() => {
    const rows: ConfirmOrder[] = orders.map((order) => {
      const items = (order.items || []).map((item) => ({
        id: item.id || `${item.productId}-${item.variantId}`,
        productName: item.productName,
        variantSize: item.variantSize,
        variantColor: item.variantColor,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        maxQuantity: item.quantity,
      }));
      const totalFromItems = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      return {
        id: order.id,
        orderNumber: order.orderNumber || order.id.slice(0, 8),
        clientName: order.clientName,
        clientPhone: order.clientPhone || '-',
        deliveryDate: order.deliveryDate ? formatDate(order.deliveryDate) : '-',
        shippingAddress: order.shippingAddress || '-',
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference || '',
        items,
        paidAmount: totalFromItems || order.totalAmount,
      };
    });
    setConfirmRows(rows);
  }, [orders]);

  const openConfirmExport = () => {
    buildConfirmRows();
    setConfirmOpen(true);
  };

  const updateConfirmItemQty = (orderId: string, itemId: string, value: number) => {
    setConfirmRows((prev) => prev.map((order) => {
      if (order.id !== orderId) return order;
      const items = order.items.map((item) => {
        if (item.id !== itemId) return item;
        const next = Math.max(0, Math.min(item.maxQuantity, value));
        return { ...item, quantity: next };
      });
      const paidAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      return { ...order, items, paidAmount };
    }));
  };

  const updateConfirmStatus = (orderId: string, status: Order['status']) => {
    setConfirmRows((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
  };

  const updateConfirmPaidAmount = (orderId: string, value: number) => {
    setConfirmRows((prev) => prev.map((order) => (order.id === orderId ? { ...order, paidAmount: Math.max(0, value) } : order)));
  };

  const confirmationStats = useMemo(() => {
    const deliveredOrders = confirmRows.filter((o) => o.status === 'delivered' || o.status === 'paid');
    const realizedRevenue = deliveredOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const deliveredItems = deliveredOrders.reduce((sum, o) => sum + o.items.reduce((acc, item) => acc + item.quantity, 0), 0);
    const paymentTotals = deliveredOrders.reduce((acc, o) => {
      const method = o.paymentMethod || 'Autre';
      acc[method] = (acc[method] || 0) + (o.paidAmount || 0);
      return acc;
    }, {} as Record<string, number>);
    const itemMap = new Map<string, { productName: string; variantLabel: string; quantity: number }>();
    deliveredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.quantity <= 0) return;
        const key = `${item.productName}__${item.variantSize}__${item.variantColor}`;
        const variantLabel = `${item.variantSize} ${item.variantColor}`.trim();
        const existing = itemMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          itemMap.set(key, { productName: item.productName, variantLabel, quantity: item.quantity });
        }
      });
    });
    return {
      realizedRevenue,
      deliveredItems,
      paymentTotals,
      deliveredOrders,
      deliveredItemsRows: Array.from(itemMap.values()),
    };
  }, [confirmRows]);

  const filteredOrders = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const clientName = (order.clientName || '').toLowerCase();
      const clientPhone = (order.clientPhone || '').toLowerCase();
      const orderNumber = (order.orderNumber || '').toLowerCase();
      return clientName.includes(q) || clientPhone.includes(q) || orderNumber.includes(q);
    });
  }, [orders, clientSearch]);

  const handleOpenExportMenu = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleCloseExportMenu = () => {
    setExportAnchorEl(null);
  };

  const handleExportPdf = () => {
    if (orders.length === 0) {
      setExportError('Aucune transaction à exporter');
      return;
    }
    try {
      exportFinanceReport(orders, dateFrom, dateTo, deliveryPersonFilter, companyName);
      enqueueSnackbar('Export PDF réussi', { variant: 'success' });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      setExportError('Erreur lors de l\'export PDF');
    }
  };

  const handleExportExcel = () => {
    if (orders.length === 0) {
      setExportError('Aucune transaction à exporter');
      return;
    }
    const rows = orders.map((order) => {
      const itemsSummary = (order.items || [])
        .map((i) => `${i.productName} (${i.quantity})`)
        .join(', ');
      return {
        'N° Commande': order.orderNumber || order.id.slice(0, 8),
        Client: order.clientName,
        Contact: order.clientPhone || '-',
        'Date Livraison': order.deliveryDate ? formatDate(order.deliveryDate) : '-',
        'Adresse Livraison': order.shippingAddress || '-',
        Articles: itemsSummary,
        Statut: getStatusLabel(order.status),
        Montant: `${order.totalAmount.toLocaleString('fr-FR')} MGA`,
      };
    });
    const headerRows = [
      [companyName],
      ['Rapport livraison journalière'],
      [`Généré le ${new Date().toLocaleDateString('fr-FR')}`],
      [],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(headerRows);
    XLSX.utils.sheet_add_json(worksheet, rows, { origin: 'A5' });
    const columnCount = Object.keys(rows[0] || {}).length || 1;
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: columnCount - 1 } },
    ];
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 26 },
      { wch: 30 },
      { wch: 12 },
      { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapport');
    XLSX.writeFile(workbook, `rapport_financier_${dateFrom}_${dateTo}.xlsx`);
  };

  const handleExportMobile = async () => {
    if (!selectedUserId) {
      enqueueSnackbar('Utilisateur requis', { variant: 'error' });
      return;
    }
    try {
      const params = new URLSearchParams({
        type: 'mobileExport',
        userId: selectedUserId,
        source: 'delivery-daily',
        dateFrom,
        dateTo,
        deliveryPerson: deliveryPersonFilter || '',
        realizedStatus: realizedStatusFilter,
        clientSearch: clientSearch || '',
      });
      const res = await fetch(`/api/settings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur export mobile');
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vente-mobile-delivery-${dateFrom}-${dateTo}.json`;
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Export mobile généré', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, 'Erreur export mobile'), { variant: 'error' });
    }
  };

  const [isExportingZip, setIsExportingZip] = useState(false);

  const handleExportRecapZip = async () => {
    const validOrders = filteredOrders.filter((o) => ['delivered', 'confirmed', 'paid'].includes(o.status));
    
    if (validOrders.length === 0) {
      enqueueSnackbar('Aucune commande valide pour l\'export (livrée, confirmée, payée)', { variant: 'warning' });
      return;
    }

    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const manifestMetadata: Record<string, { clientName: string; totalAmount: number }> = {};
      let clientCounter = 1;
      const DELIVERY_FEE = 0;
      
      const theme = {
        headerBg: '#1857a8',
        headerText: '#ffffff',
        tableHeaderBg: '#2f86bf',
        tableHeaderText: '#ffffff',
        totalAccent: '#1857a8',
      };

      for (const order of validOrders) {
        const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const currentClientNumber = clientCounter++;
        
        const payload = {
          companyName,
          liveTitle: `Livraisons du ${dateFrom} au ${dateTo}`,
          clientNumber: currentClientNumber,
          clientName: order.clientName,
          clientPhone: order.clientPhone || '',
          shippingAddress: order.shippingAddress || '',
          subtotal: subtotal,
          deliveryFee: DELIVERY_FEE,
          totalAmount: order.totalAmount,
          itemCount: itemCount,
          status: order.status,
          paymentMethod: order.paymentMethod || '',
          lines: order.items.map((item) => ({
            id: item.id || crypto.randomUUID(),
            productName: item.productName,
            variantSize: item.variantSize,
            variantColor: item.variantColor,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        };

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '400px';
        container.style.background = '#ffffff';
        container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        container.style.padding = '20px';
        
        container.innerHTML = `
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="background: ${theme.headerBg}; color: ${theme.headerText}; border-radius: 1rem; padding: 1rem 0.5rem;">
              <div style="font-weight: bold; font-size: 1.5rem; text-transform: uppercase;">${payload.companyName}</div>
              <div>${payload.liveTitle}</div>
            </div>
          </div>
          <div style="font-weight: bold; font-size: 1.5rem;">Client N°${payload.clientNumber}: ${payload.clientName}</div>
          <div style="color: #6c757d; margin-top: 0.5rem;">Contact: ${payload.clientPhone}</div>
          <div style="color: #6c757d;">Lieux de livraison: ${payload.shippingAddress}</div>
          <div style="margin-top: 1.5rem; border: 1px solid #dee2e6; border-radius: 1rem; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="background: ${theme.tableHeaderBg}; color: ${theme.tableHeaderText};">
                <tr>
                  <th style="padding: 0.5rem; text-align: left;">Articles</th>
                  <th style="padding: 0.5rem; text-align: center;">Qté</th>
                  <th style="padding: 0.5rem; text-align: right;">P.U</th>
                  <th style="padding: 0.5rem; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${payload.lines.map(line => `
                  <tr style="border-top: 1px solid #dee2e6;">
                    <td style="padding: 0.5rem;">
                      <div style="font-weight: 500;">${line.productName}</div>
                      <div style="color: #6c757d; font-size: 0.875rem;">${line.variantSize} ${line.variantColor}</div>
                    </td>
                    <td style="padding: 0.5rem; text-align: center; vertical-align: middle;">${line.quantity}</td>
                    <td style="padding: 0.5rem; text-align: right; vertical-align: middle;">${line.unitPrice.toLocaleString('fr-FR')}</td>
                    <td style="padding: 0.5rem; text-align: right; vertical-align: middle; font-weight: 500;">${line.totalPrice.toLocaleString('fr-FR')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="border-top: 3px solid #dee2e6; margin-top: 1.5rem; padding-top: 1rem;">
            <div style="display: flex; justify-content: flex-end; gap: 1rem; color: #6c757d;">
              <span>Sous-total :</span>
              <span style="font-weight: 600; color: #212529;">${payload.subtotal.toLocaleString('fr-FR')} Ar</span>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 1rem; color: #6c757d; margin-top: 0.5rem;">
              <span>Frais de livraison :</span>
              <span style="font-weight: 600; color: #212529;">${payload.deliveryFee.toLocaleString('fr-FR')} Ar</span>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; align-items: center;">
              <span style="font-weight: bold; font-size: 1.5rem;">TOTAL A PAYER :</span>
              <span style="font-weight: bold; font-size: 2rem; color: ${theme.totalAccent};">${payload.totalAmount.toLocaleString('fr-FR')} Ar</span>
            </div>
          </div>
          <div style="text-align: right; color: #6c757d; margin-top: 0.5rem;">(${payload.itemCount} articles)</div>
        `;
        
        document.body.appendChild(container);
        
        try {
          const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
          });
          
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const fileName = `client_${String(currentClientNumber).padStart(3, '0')}_${order.clientName.replace(/[^a-z0-9]/gi, '_')}.png`;
            zip.file(fileName, blob);
            manifestMetadata[fileName] = {
              clientName: order.clientName,
              totalAmount: order.totalAmount
            };
          }
        } finally {
          document.body.removeChild(container);
        }
      }

      zip.file('manifest.json', JSON.stringify({ type: 'livreur', livreur: deliveryPersonFilter, metadata: manifestMetadata }));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      let zipName = `recap-mobile-livraisons-${dateFrom}-${dateTo}.zip`;
      if (deliveryPersonFilter) {
        zipName = `${deliveryPersonFilter},${companyName}_${dateFrom}_${dateTo}.zip`.replace(/[/\\?%*:|"<>]/g, '-');
      }
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Export Recap ZIP généré', { variant: 'success' });
    } catch (error) {
      console.error('Erreur génération ZIP:', error);
      enqueueSnackbar('Erreur lors de la génération du ZIP', { variant: 'error' });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportConfirmPdf = async () => {
    if (confirmationStats.deliveredOrders.length === 0) {
      enqueueSnackbar('Aucune livraison confirmée à exporter', { variant: 'warning' });
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(companyName, 14, 16);
    doc.setFontSize(18);
    doc.text('Confirmation des livraisons', 14, 28);
    doc.setFontSize(11);
    doc.setTextColor(100);
    const subTitle = `Période : du ${formatDate(dateFrom)} au ${formatDate(dateTo)}` + (deliveryPersonFilter ? ` | Livreur : ${deliveryPersonFilter}` : '');
    doc.text(subTitle, 14, 36);

    doc.setFontSize(10);
    doc.setTextColor(0);
    let y = 46;
    doc.text(`Recettes réalisées: ${formatMoney(confirmationStats.realizedRevenue)} MGA`, 14, y);
    y += 6;
    doc.text(`Articles livrés: ${confirmationStats.deliveredItems}`, 14, y);
    y += 8;
    doc.text('Détail des paiements (Livrées/Payées) :', 14, y);
    y += 6;
    Object.entries(confirmationStats.paymentTotals).forEach(([method, amount]) => {
      doc.text(`- ${method}: ${formatMoney(amount)} MGA`, 20, y);
      y += 5;
    });

    autoTable(doc, {
      startY: y + 6,
      head: [['Produit', 'Variante', 'Quantité livrée']],
      body: confirmationStats.deliveredItemsRows.map((row) => [
        row.productName,
        row.variantLabel || '-',
        String(row.quantity),
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });

    const lastY = ((doc as unknown) as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 20;
    autoTable(doc, {
      startY: lastY + 8,
      head: [['N° Commande', 'Client', 'Contact', 'Date Livraison', 'Adresse Livraison', 'Statut', 'Paiement', 'Montant payé']],
      body: confirmationStats.deliveredOrders.map((o) => [
        o.orderNumber,
        o.clientName,
        o.clientPhone,
        o.deliveryDate,
        o.shippingAddress,
        getStatusLabel(o.status),
        getPaymentLabel(o.paymentMethod),
        `${formatMoney(o.paidAmount)} MGA`,
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        3: { cellWidth: 20 },
        6: { cellWidth: 22 },
        7: { halign: 'right' },
      },
    });

    doc.save(`confirmation_livraisons_${dateFrom}_${dateTo}.pdf`);
  };

  const handleExportConfirmExcel = () => {
    if (confirmationStats.deliveredOrders.length === 0) {
      enqueueSnackbar('Aucune livraison confirmée à exporter', { variant: 'warning' });
      return;
    }
    const deliveriesRows = confirmationStats.deliveredOrders.map((o) => ({
      'N° Commande': o.orderNumber,
      Client: o.clientName,
      Contact: o.clientPhone,
      'Date Livraison': o.deliveryDate,
      'Adresse Livraison': o.shippingAddress,
      Statut: getStatusLabel(o.status),
      Paiement: getPaymentLabel(o.paymentMethod),
      'Montant payé': `${formatMoney(o.paidAmount)} MGA`,
    }));
    const itemsRows = confirmationStats.deliveredItemsRows.map((row) => ({
      Produit: row.productName,
      Variante: row.variantLabel || '-',
      'Quantité livrée': row.quantity,
    }));
    const paymentRows = Object.entries(confirmationStats.paymentTotals).map(([method, amount]) => ({
      Paiement: method,
      Montant: `${formatMoney(amount)} MGA`,
    }));

    const buildSheet = (title: string, rows: Record<string, unknown>[]) => {
      const headerRows = [
        [companyName],
        [title],
        [`Période : du ${formatDate(dateFrom)} au ${formatDate(dateTo)}` + (deliveryPersonFilter ? ` | Livreur : ${deliveryPersonFilter}` : '')],
        [],
      ];
      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5' });
      const columnCount = Object.keys(rows[0] || {}).length || 1;
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: columnCount - 1 } },
      ];
      return ws;
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, buildSheet('Livraisons confirmées', deliveriesRows), 'Livraisons');
    XLSX.utils.book_append_sheet(workbook, buildSheet('Articles livrés', itemsRows), 'Articles');
    XLSX.utils.book_append_sheet(workbook, buildSheet('Détail des paiements', paymentRows), 'Paiements');
    XLSX.writeFile(workbook, `confirmation_livraisons_${dateFrom}_${dateTo}.xlsx`);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Statistique de livraison journalière" subtitle="Suivi quotidien des livraisons" />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading && <LinearProgress />}

          <Box sx={{ p: 3 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonth color="primary" />
                  <Typography variant="h6">Période :</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    label="Date début"
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 160 }}
                  />
                  <Typography color="text.secondary">à</Typography>
                  <TextField
                    label="Date fin"
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 160 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControl size="small" sx={{ width: 200 }}>
                    <InputLabel>Filtrer par livreur</InputLabel>
                    <Select
                      value={deliveryPersonFilter}
                      label="Filtrer par livreur"
                      onChange={(e) => setDeliveryPersonFilter(e.target.value)}
                    >
                      <MenuItem value="">Tous les livreurs</MenuItem>
                      {availableDeliverers.map((person) => (
                        <MenuItem key={person} value={person}>{person}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControl size="small" sx={{ width: 220 }}>
                    <InputLabel>Recettes réalisées</InputLabel>
                    <Select
                      value={realizedStatusFilter}
                      label="Recettes réalisées"
                      onChange={(e) => setRealizedStatusFilter(e.target.value as 'delivered' | 'confirmed')}
                    >
                      <MenuItem value="delivered">Statut livrée</MenuItem>
                      <MenuItem value="confirmed">Statut confirmée</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ ml: 'auto' }}>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={handleOpenExportMenu}
                    disabled={loading}
                  >
                    Exporter
                  </Button>
                  <Button
                    variant="outlined"
                    sx={{ ml: 1 }}
                    onClick={openConfirmExport}
                    disabled={loading}
                  >
                    Export 2
                  </Button>
                  <Menu
                    anchorEl={exportAnchorEl}
                    open={Boolean(exportAnchorEl)}
                    onClose={handleCloseExportMenu}
                  >
                    <MenuItem onClick={() => { handleCloseExportMenu(); handleExportPdf(); }}>
                      Exporter PDF
                    </MenuItem>
                    <MenuItem onClick={() => { handleCloseExportMenu(); handleExportExcel(); }}>
                      Exporter Excel
                    </MenuItem>
                    <MenuItem onClick={() => { handleCloseExportMenu(); handleExportRecapZip(); }} disabled={isExportingZip}>
                      {isExportingZip ? 'Génération ZIP...' : 'Exporter Recap en Image (.zip)'}
                    </MenuItem>
                  </Menu>
                </Box>
              </CardContent>
            </Card>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Recettes Réalisées"
                  value={`${stats.realizedRevenue.toLocaleString('fr-FR')} MGA`}
                  icon={<AttachMoney />}
                  color="#10B981"
                  bgColor="#ECFDF5"
                  subtitle={realizedStatusFilter === 'delivered' ? 'Statut livrée' : 'Statut confirmée'}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Articles livrés"
                  value={stats.deliveredItems}
                  icon={<Inventory />}
                  color="#2563EB"
                  bgColor="#DBEAFE"
                  subtitle="Total des articles livrés"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Recettes Prévues"
                  value={`${stats.expectedRevenue.toLocaleString('fr-FR')} MGA`}
                  icon={<Inventory />}
                  color="#3B82F6"
                  bgColor="#EFF6FF"
                  subtitle="Total (hors annulées)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Volume commandes"
                  value={stats.count}
                  icon={<ShoppingCart />}
                  color="#8B5CF6"
                  bgColor="#F3F0FF"
                  subtitle={`${stats.deliveredCount} livrées / ${stats.pendingCount} en attente`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Taux de livraison"
                  value={`${stats.count > 0 ? Math.round((stats.deliveredCount / stats.count) * 100) : 0}%`}
                  icon={<CheckCircle />}
                  color="#F59E0B"
                  bgColor="#FFFBEB"
                />
              </Grid>
            </Grid>

            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Confirmation des livraisons</DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                  <Typography variant="body2">Période : {formatDate(dateFrom)} → {formatDate(dateTo)}</Typography>
                  {deliveryPersonFilter && <Typography variant="body2">Livreur : {deliveryPersonFilter}</Typography>}
                  <Typography variant="body2">Recettes réalisées : {formatMoney(confirmationStats.realizedRevenue)} MGA</Typography>
                  <Typography variant="body2">Articles livrés : {confirmationStats.deliveredItems}</Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>N° Commande</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Date livraison</TableCell>
                        <TableCell>Adresse</TableCell>
                        <TableCell>Statut</TableCell>
                        <TableCell>Articles livrés</TableCell>
                        <TableCell align="right">Montant payé</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {confirmRows.map((order) => (
                        <TableRow key={order.id} hover>
                          <TableCell>{order.orderNumber}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{order.clientName}</Typography>
                            <Typography variant="caption" color="text.secondary">{order.clientPhone}</Typography>
                          </TableCell>
                          <TableCell>{order.deliveryDate}</TableCell>
                          <TableCell>{order.shippingAddress}</TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                              <Select
                                value={order.status}
                                onChange={(e) => updateConfirmStatus(order.id, e.target.value as Order['status'])}
                              >
                                <MenuItem value="delivered">Livrée</MenuItem>
                                <MenuItem value="paid">Payée</MenuItem>
                                <MenuItem value="confirmed">Confirmée</MenuItem>
                                <MenuItem value="cancelled">Annulée</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {order.items.map((item) => (
                                <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" sx={{ minWidth: 180 }}>
                                    {item.productName} ({item.variantSize} {item.variantColor})
                                  </Typography>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateConfirmItemQty(order.id, item.id, Number(e.target.value || 0))}
                                    sx={{ width: 90 }}
                                    slotProps={{ htmlInput: { min: 0, max: item.maxQuantity } }}
                                  />
                                  <Typography variant="caption" color="text.secondary">/ {item.maxQuantity}</Typography>
                                </Box>
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={order.paidAmount}
                              onChange={(e) => updateConfirmPaidAmount(order.id, Number(e.target.value || 0))}
                              sx={{ width: 120 }}
                              slotProps={{ htmlInput: { min: 0 } }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={6} align="right">
                          <Typography fontWeight={600}>Total payé</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700}>{formatMoney(confirmationStats.realizedRevenue)} MGA</Typography>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmOpen(false)}>Fermer</Button>
                <Button variant="outlined" onClick={handleExportConfirmExcel}>Exporter Excel</Button>
                <Button variant="contained" onClick={handleExportConfirmPdf}>Exporter PDF</Button>
                <Button variant="contained" color="secondary" onClick={handleExportConfirmJpg} disabled={isExportingJpg}>
                  {isExportingJpg ? 'Génération JPG...' : 'Exporter Image (JPG)'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Hidden Container for JPG Export */}
            <Box sx={{ position: 'absolute', left: '-9999px', top: 0, overflow: 'hidden' }}>
              <Box ref={exportJpgRef} sx={{ width: 1080, height: 1920, bgcolor: 'background.paper', p: 8, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h2" align="center" gutterBottom fontWeight="bold" sx={{ color: 'primary.main' }}>
                  {company.name || 'Statistiques de Livraison'}
                </Typography>
                <Typography variant="h4" align="center" color="text.secondary" gutterBottom>
                  Période : {formatDate(dateFrom)} {dateFrom !== dateTo ? `au ${formatDate(dateTo)}` : ''}
                </Typography>
                {deliveryPersonFilter && (
                  <Typography variant="h5" align="center" color="text.secondary" gutterBottom>
                    Livreur : {deliveryPersonFilter}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-around', my: 6, p: 4, bgcolor: 'grey.100', borderRadius: 4 }}>
                  <Box textAlign="center">
                    <Typography variant="h5" color="text.secondary">Recettes Réalisées</Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: '#10B981', mt: 1 }}>{formatMoney(confirmationStats.realizedRevenue)} MGA</Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h5" color="text.secondary">Articles Livrés</Typography>
                    <Typography variant="h3" fontWeight="bold" color="primary.main" sx={{ mt: 1 }}>{confirmationStats.deliveredItems}</Typography>
                  </Box>
                </Box>

                <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, pb: 1, borderBottom: '2px solid', borderColor: 'divider' }}>
                  Détail des livraisons
                </Typography>

                <TableContainer sx={{ flexGrow: 1, '& .MuiTableCell-root': { fontSize: '1.2rem', py: 2 } }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Client</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Articles</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Statut</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }} align="right">Montant</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {confirmRows.slice(0, 15).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Typography fontWeight="bold" fontSize="1.3rem">{order.clientName}</Typography>
                            <Typography color="text.secondary" fontSize="1.1rem">{order.shippingAddress}</Typography>
                          </TableCell>
                          <TableCell>
                            {order.items.map(item => (
                              <Box key={item.id} sx={{ fontSize: '1.2rem' }}>{item.quantity}x {item.productName}</Box>
                            ))}
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ 
                              display: 'inline-block', px: 2, py: 0.5, borderRadius: 2, fontSize: '1.1rem', fontWeight: 'bold',
                              bgcolor: order.status === 'delivered' ? '#ECFDF5' : order.status === 'paid' ? '#F0FDF4' : order.status === 'cancelled' ? '#FEF2F2' : '#EFF6FF',
                              color: order.status === 'delivered' ? '#10B981' : order.status === 'paid' ? '#16A34A' : order.status === 'cancelled' ? '#EF4444' : '#3B82F6'
                            }}>
                              {order.status === 'delivered' ? 'Livrée' : order.status === 'paid' ? 'Payée' : order.status === 'confirmed' ? 'Confirmée' : 'Annulée'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.3rem' }}>
                            {formatMoney(order.paidAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {confirmRows.length > 15 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography color="text.secondary" fontStyle="italic" fontSize="1.2rem">
                              ... et {confirmRows.length - 15} autres livraisons
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 'auto', pt: 4, borderTop: '3px solid', borderColor: 'divider', textAlign: 'center' }}>
                  <Typography variant="h5" color="text.secondary">
                    Généré le {currentDate ? `${currentDate.toLocaleDateString('fr-FR')} à ${currentDate.toLocaleTimeString('fr-FR')}` : ''} - {company.name}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Card>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">
                  Transactions du {formatDate(dateFrom)} au {formatDate(dateTo)}
                </Typography>
                <TextField
                  size="small"
                  label="Rechercher client"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  sx={{ minWidth: 280 }}
                />
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>N° Commande</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Date de livraison</TableCell>
                      <TableCell>Lieu de livraison</TableCell>
                      <TableCell>Articles</TableCell>
                      <TableCell align="center">Statut</TableCell>
                      <TableCell align="right">Montant</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                            {order.orderNumber || order.id.slice(0, 8)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{order.clientName}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{order.clientPhone || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('fr-FR') : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {order.shippingAddress || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(order.items || []).map((item, i) => (
                            <Typography key={i} variant="caption" display="block">
                              {item.productName} ({item.quantity})
                            </Typography>
                          ))}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <FormControl size="small" sx={{ minWidth: 135 }}>
                              <Select
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order, e.target.value as Order['status'])}
                                disabled={updatingOrderId === order.id}
                              >
                                <MenuItem value="pending">En attente</MenuItem>
                                <MenuItem value="confirmed">Confirmée</MenuItem>
                                <MenuItem value="shipping">En livraison</MenuItem>
                                <MenuItem value="delivered">Livrée</MenuItem>
                                <MenuItem value="paid">Payée</MenuItem>
                                <MenuItem value="cancelled">Annulée</MenuItem>
                              </Select>
                            </FormControl>
                            {updatingOrderId === order.id && <CircularProgress size={16} />}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color={order.status === 'cancelled' ? 'text.disabled' : 'primary'}>
                            {order.totalAmount.toLocaleString('fr-FR')} MGA
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">Aucune commande trouvée pour cette période</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Box>
        </Box>
      </Box>
      <Dialog open={Boolean(exportError)} onClose={() => setExportError(null)}>
        <DialogTitle>Export</DialogTitle>
        <DialogContent>
          <Typography>{exportError}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportError(null)}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
