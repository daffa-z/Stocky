"use client";

import { AnalyticsCard } from "@/components/ui/analytics-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/ui/chart-card";
import { ForecastingCard } from "@/components/ui/forecasting-card";
import { QRCodeComponent } from "@/components/ui/qr-code";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Download,
  Eye,
  Package,
  PieChart as PieChartIcon,
  QrCode,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../authContext";
import AuthenticatedLayout from "../components/AuthenticatedLayout";
import { useProductStore } from "../useProductStore";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];


interface SalesSummaryData {
  periods: {
    daily: { sales: number; profit: number; invoiceCount: number };
    weekly: { sales: number; profit: number; invoiceCount: number };
    monthly: { sales: number; profit: number; invoiceCount: number };
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);


const formatTimelineDate = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const getPeriodTimeline = (period: "daily" | "weekly" | "monthly") => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    const currentDay = now.getDay(); // Sunday = 0, Saturday = 6
    start.setDate(now.getDate() - currentDay);
    start.setHours(0, 0, 0, 0);

    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return `${formatTimelineDate(start)} - ${formatTimelineDate(end)}`;
};

export default function BusinessInsightsPage() {
  const { allProducts } = useProductStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [salesSummary, setSalesSummary] = useState<SalesSummaryData | null>(null);
  const [isSalesSummaryLoading, setIsSalesSummaryLoading] = useState(true);

  useEffect(() => {
    const loadSalesSummary = async () => {
      if (!user) return;
      try {
        setIsSalesSummaryLoading(true);
        const response = await axiosInstance.get("/business-insights/sales-summary");
        setSalesSummary(response.data);
      } catch (error: any) {
        toast({
          title: "Failed to load sales summary",
          description: error?.response?.data?.error || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSalesSummaryLoading(false);
      }
    };

    loadSalesSummary();
  }, [toast, user]);

  // Calculate analytics data with corrected calculations
  const analyticsData = useMemo(() => {
    if (!allProducts || allProducts.length === 0) {
      return {
        totalProducts: 0,
        totalValue: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        averagePrice: 0,
        totalQuantity: 0,
        categoryDistribution: [],
        statusDistribution: [],
        priceRangeDistribution: [],
        monthlyTrend: [],
        topProducts: [],
        lowStockProducts: [],
        stockUtilization: 0,
        valueDensity: 0,
        stockCoverage: 0,
      };
    }

    const totalProducts = allProducts.length;

    // CORRECTED: Total value calculation - sum of (price * quantity) for each product
    const totalValue = allProducts.reduce((sum, product) => {
      return sum + product.price * Number(product.quantity);
    }, 0);

    // CORRECTED: Low stock items - products with quantity > 0 AND quantity <= 20 (matching product table logic)
    const lowStockItems = allProducts.filter(
      (product) =>
        Number(product.quantity) > 0 && Number(product.quantity) <= 20
    ).length;

    // CORRECTED: Out of stock items - products with quantity = 0
    const outOfStockItems = allProducts.filter(
      (product) => Number(product.quantity) === 0
    ).length;

    // CORRECTED: Total quantity - sum of all quantities
    const totalQuantity = allProducts.reduce((sum, product) => {
      return sum + Number(product.quantity);
    }, 0);

    // CORRECTED: Average price calculation - total value divided by total quantity
    const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    // CORRECTED: Stock utilization - percentage of products that are not out of stock
    const stockUtilization =
      totalProducts > 0
        ? ((totalProducts - outOfStockItems) / totalProducts) * 100
        : 0;

    // CORRECTED: Value density - total value divided by total products
    const valueDensity = totalProducts > 0 ? totalValue / totalProducts : 0;

    // CORRECTED: Stock coverage - average quantity per product
    const stockCoverage = totalProducts > 0 ? totalQuantity / totalProducts : 0;

    // Category distribution based on quantity (not just count)
    const categoryMap = new Map<
      string,
      { count: number; quantity: number; value: number }
    >();
    allProducts.forEach((product) => {
      const category = product.category || "Unknown";
      const current = categoryMap.get(category) || {
        count: 0,
        quantity: 0,
        value: 0,
      };
      categoryMap.set(category, {
        count: current.count + 1,
        quantity: current.quantity + Number(product.quantity),
        value: current.value + product.price * Number(product.quantity),
      });
    });

    // Convert to percentage based on quantity
    const categoryDistribution = Array.from(categoryMap.entries()).map(
      ([name, data]) => ({
        name,
        value: data.quantity,
        count: data.count,
        totalValue: data.value,
      })
    );

    // Status distribution
    const statusMap = new Map<string, number>();
    allProducts.forEach((product) => {
      const status = product.status || "Unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const statusDistribution = Array.from(statusMap.entries()).map(
      ([name, value]) => ({ name, value })
    );

    // Price range distribution
    const priceRanges = [
      { name: "Rp0-Rp100", min: 0, max: 100 },
      { name: "Rp100-Rp500", min: 100, max: 500 },
      { name: "Rp500-Rp1000", min: 500, max: 1000 },
      { name: "Rp1000-Rp2000", min: 1000, max: 2000 },
      { name: "Rp2000+", min: 2000, max: Infinity },
    ];

    const priceRangeDistribution = priceRanges.map((range, index) => ({
      name: range.name,
      value: allProducts.filter((product) => {
        if (range.name === "Rp2000+") {
          // For Rp2000+ range, include products > Rp2000 (not including Rp2000)
          return product.price > 2000;
        } else if (range.name === "Rp1000-Rp2000") {
          // For Rp1000-Rp2000 range, include products >= Rp1000 and <= Rp2000
          return product.price >= range.min && product.price <= range.max;
        } else {
          // For other ranges, include products >= min and < max (exclusive upper bound)
          return product.price >= range.min && product.price < range.max;
        }
      }).length,
    }));

    // CORRECTED: Monthly trend based on actual product creation dates
    const monthlyTrend: Array<{
      month: string;
      products: number;
      monthlyAdded: number;
    }> = [];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Group products by creation month using UTC to avoid timezone issues
    const productsByMonth = new Map<string, number>();
    allProducts.forEach((product) => {
      const date = new Date(product.createdAt);
      // Use UTC methods to ensure consistent month extraction
      const monthKey = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
      ).padStart(2, "0")}`;
      productsByMonth.set(monthKey, (productsByMonth.get(monthKey) || 0) + 1);
    });

    // Create trend data for the whole year
    // Use the year from the first product's creation date to ensure correct year mapping
    const dataYear =
      allProducts.length > 0
        ? new Date(allProducts[0].createdAt).getUTCFullYear()
        : new Date().getUTCFullYear();
    let cumulativeProducts = 0;

    months.forEach((month, index) => {
      const monthKey = `${dataYear}-${String(index + 1).padStart(2, "0")}`;
      const productsThisMonth = productsByMonth.get(monthKey) || 0;
      cumulativeProducts += productsThisMonth;

      monthlyTrend.push({
        month,
        products: cumulativeProducts,
        monthlyAdded: productsThisMonth,
      });
    });

    // Top products by value
    const topProducts = allProducts
      .sort(
        (a, b) => b.price * Number(b.quantity) - a.price * Number(a.quantity)
      )
      .slice(0, 5)
      .map((product) => ({
        name: product.name,
        value: product.price * Number(product.quantity),
        quantity: Number(product.quantity),
      }));

    // Low stock products (matching product table logic: quantity > 0 AND quantity <= 20)
    const lowStockProducts = allProducts
      .filter(
        (product) =>
          Number(product.quantity) > 0 && Number(product.quantity) <= 20
      )
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .slice(0, 5);

    return {
      totalProducts,
      totalValue,
      lowStockItems,
      outOfStockItems,
      averagePrice,
      totalQuantity,
      stockUtilization,
      valueDensity,
      stockCoverage,
      categoryDistribution,
      statusDistribution,
      priceRangeDistribution,
      monthlyTrend,
      topProducts,
      lowStockProducts,
    };
  }, [allProducts]);

  const handleExportAnalytics = () => {
    toast({
      title: "Ekspor Analitik",
      description: "Fitur ekspor analitik akan segera hadir!",
    });
  };

  if (!user) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              Silakan masuk untuk melihat wawasan bisnis.
            </p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-primary">
              Wawasan Bisnis
            </h1>
            <p className="text-lg text-muted-foreground">
              Wawasan menyeluruh terhadap performa inventaris Anda
            </p>
          </div>
          <Button
            onClick={handleExportAnalytics}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Ekspor Analitik
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total Produk"
            value={analyticsData.totalProducts}
            icon={Package}
            iconColor="text-blue-600"
            description="Produk dalam inventaris"
          />
          <AnalyticsCard
            title="Total Nilai"
            value={formatCurrency(analyticsData.totalValue)}
            icon={DollarSign}
            iconColor="text-green-600"
            description="Total nilai inventaris"
          />
          <AnalyticsCard
            title="Stok Menipis"
            value={analyticsData.lowStockItems}
            icon={AlertTriangle}
            iconColor="text-orange-600"
            description="Item dengan kuantitas <= 20"
          />
          <AnalyticsCard
            title="Stok Habis"
            value={analyticsData.outOfStockItems}
            icon={ShoppingCart}
            iconColor="text-red-600"
            description="Item dengan kuantitas 0"
          />
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Penjualan & Ringkasan Keuntungan</CardTitle>
          </CardHeader>
          <CardContent>
            {isSalesSummaryLoading ? (
              <p className="text-sm text-muted-foreground">Memuat ringkasan penjualan...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Daily</CardTitle>
                    <p className="text-xs text-muted-foreground">Rentang Waktu: {getPeriodTimeline("daily")}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Total Penjualan</span><span className="font-semibold">{formatCurrency(salesSummary?.periods.daily.sales || 0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Ringkasan Keuntungan</span><span className="font-semibold text-emerald-600">{formatCurrency(salesSummary?.periods.daily.profit || 0)}</span></div>
                    <div className="text-xs text-muted-foreground">Invoice: {salesSummary?.periods.daily.invoiceCount || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Weekly</CardTitle>
                    <p className="text-xs text-muted-foreground">Rentang Waktu: {getPeriodTimeline("weekly")}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Total Penjualan</span><span className="font-semibold">{formatCurrency(salesSummary?.periods.weekly.sales || 0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Ringkasan Keuntungan</span><span className="font-semibold text-emerald-600">{formatCurrency(salesSummary?.periods.weekly.profit || 0)}</span></div>
                    <div className="text-xs text-muted-foreground">Invoice: {salesSummary?.periods.weekly.invoiceCount || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Monthly</CardTitle>
                    <p className="text-xs text-muted-foreground">Rentang Waktu: {getPeriodTimeline("monthly")}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Total Penjualan</span><span className="font-semibold">{formatCurrency(salesSummary?.periods.monthly.sales || 0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Ringkasan Keuntungan</span><span className="font-semibold text-emerald-600">{formatCurrency(salesSummary?.periods.monthly.profit || 0)}</span></div>
                    <div className="text-xs text-muted-foreground">Invoice: {salesSummary?.periods.monthly.invoiceCount || 0}</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts and Insights */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Ringkasan</TabsTrigger>
            <TabsTrigger value="distribution">Distribusi</TabsTrigger>
            <TabsTrigger value="trends">Tren</TabsTrigger>
            <TabsTrigger value="alerts">Peringatan</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Category Distribution */}
              <ChartCard title="Distribusi Kategori" icon={PieChartIcon}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.categoryDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analyticsData.categoryDistribution.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Monthly Trend - Full Year */}
              <ChartCard
                title="Tren Pertumbuhan Produk (Satu Tahun)"
                icon={TrendingUp}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="products"
                      stroke="#8884d8"
                      fill="#8884d8"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status Distribution */}
              <ChartCard title="Distribusi Status" icon={Activity}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.statusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Price Range Distribution */}
              <ChartCard title="Distribusi Rentang Harga" icon={BarChart3}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.priceRangeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Products by Value */}
              <ChartCard title="Produk Teratas Berdasarkan Nilai" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analyticsData.topProducts}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Nilai",
                      ]}
                      labelFormatter={(label) => `Product: ${label}`}
                    />
                    <Bar dataKey="value" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Monthly Product Addition Trend */}
              <ChartCard title="Penambahan Produk Bulanan" icon={TrendingDown}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="monthlyAdded"
                      stroke="#FF8042"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {/* Low Stock Alerts */}
            <ChartCard title="Peringatan Stok Menipis" icon={AlertTriangle}>
              <div className="space-y-4">
                {analyticsData.lowStockProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyticsData.lowStockProducts.map((product, index) => (
                      <Card
                        key={index}
                        className="border-orange-200 bg-orange-50 dark:bg-orange-950/20"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-sm">
                                {product.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                SKU: {product.sku}
                              </p>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {product.quantity} tersisa
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Tidak ada peringatan stok menipis saat ini!
                    </p>
                  </div>
                )}
              </div>
            </ChartCard>
          </TabsContent>
        </Tabs>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Wawasan Cepat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Harga Rata-rata</span>
                <span className="font-semibold">
                  {formatCurrency(analyticsData.averagePrice)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Kuantitas</span>
                <span className="font-semibold">
                  {analyticsData.totalQuantity.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Utilisasi Stok</span>
                <span className="font-semibold">
                  {analyticsData.stockUtilization.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Performa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Kesehatan Inventaris</span>
                <Badge
                  variant={
                    analyticsData.lowStockItems > 5 ? "destructive" : "default"
                  }
                >
                  {analyticsData.lowStockItems > 5
                    ? "Perlu Perhatian"
                    : "Sehat"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cakupan Stok</span>
                <span className="font-semibold">
                  {analyticsData.stockCoverage.toFixed(1)} units avg
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Kepadatan Nilai</span>
                <span className="font-semibold">
                  {formatCurrency(analyticsData.valueDensity)} per produk
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Kode QR Cepat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QRCodeComponent
                data={`${window.location.origin}/business-insights`}
                title="QR Dasbor"
                size={120}
                showDownload={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Forecasting Section */}
        <ForecastingCard products={allProducts} />
      </div>
    </AuthenticatedLayout>
  );
}
