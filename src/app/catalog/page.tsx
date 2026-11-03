"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import { Product, Category } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { HeaderBar } from "../../components/pos/HeaderBar.tsx";
import { ProductFormModal } from "../../components/catalog/ProductFormModal.tsx";
import { CategoryFormModal } from "../../components/catalog/CategoryFormModal.tsx";
import { formatBaht } from "../../utils/currency.ts";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Tag,
  Barcode,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
} from "lucide-react";

export default function CatalogPage() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "categories">(
    "products"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals for Products
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Modals for Categories
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = user?.role?.toLowerCase() === "admin";

  // Route protection
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push("/login");
    }
  }, [token, isAuthLoading, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get<{ data: Product[]; success: boolean }>(
          "/products?limit=500"
        ),
        apiClient.get<{ data: Category[]; success: boolean }>("/categories"),
      ]);

      if (prodRes && prodRes.data) {
        setProducts(prodRes.data);
      }
      if (catRes && catRes.data) {
        setCategories(catRes.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load catalog data:", err);
      setError("ไม่สามารถดึงข้อมูลรายการสินค้าได้ (ตรวจสอบการเชื่อมต่อ API)");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === "ALL" || p.category_id === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategoryPrompt = (cat: Category) => {
    setDeletingCategory(cat);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/categories/${deletingCategory.id}`);
      setDeletingCategory(null);
      toast.success("ลบหมวดหมู่สินค้าเรียบร้อยแล้ว");
      await loadData();
    } catch (err: unknown) {
      console.error("Failed to delete category:", err);
      let errMsg = "เกิดข้อผิดพลาดในการลบหมวดหมู่สินค้า";
      if (err && typeof err === "object" && "data" in err) {
        const d = (err as { data?: { message?: string } }).data;
        if (d?.message) {
          errMsg = d.message;
        }
      } else if (err instanceof Error) {
        errMsg = err.message;
      }
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isAuthLoading || (!token && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-xl font-bold text-base-content/70">
          กำลังตรวจสอบสิทธิ์...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <HeaderBar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Page Title & Main Action Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-base-content flex items-center gap-2.5">
              <Package className="w-8 h-8 text-primary" />
              จัดการสินค้าและแคตตาล็อก (Catalog)
            </h2>
            <p className="text-sm font-semibold text-base-content/60 mt-1">
              เพิ่ม แก้ไข กำหนดราคา จัดการบาร์โค้ด และจัดหมวดหมู่สินค้า
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "products" ? (
              <button
                type="button"
                onClick={handleCreate}
                className="btn btn-primary h-12 px-5 font-black rounded-2xl gap-2 shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span>เพิ่มสินค้าใหม่</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={!isAdmin}
                title={!isAdmin ? "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น" : ""}
                className="btn btn-primary h-12 px-5 font-black rounded-2xl gap-2 shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span>เพิ่มหมวดหมู่ใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex border-b-2 border-base-300 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`pb-3 px-4 font-black text-base flex items-center gap-2 border-b-4 transition-all -mb-[2px] ${
              activeTab === "products"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <Package className="w-5 h-5" />
            <span>สินค้าทั้งหมด ({products.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`pb-3 px-4 font-black text-base flex items-center gap-2 border-b-4 transition-all -mb-[2px] ${
              activeTab === "categories"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/60 hover:text-base-content"
            }`}
          >
            <Tag className="w-5 h-5" />
            <span>จัดการหมวดหมู่ ({categories.length})</span>
          </button>
        </div>

        {/* Tab 1: Products */}
        {activeTab === "products" && (
          <div className="space-y-6">
            {/* Filter Controls Card */}
            <div className="card bg-base-100 border-2 border-base-300 p-4 rounded-3xl shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                {/* Search */}
                <div className="relative w-full md:w-96">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาชื่อสินค้า, รหัสสินค้า, บาร์โค้ด..."
                    className="input input-bordered w-full h-12 pl-11 pr-4 font-bold rounded-2xl"
                  />
                </div>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={loadData}
                  disabled={isLoading}
                  className="btn btn-outline h-12 px-4 rounded-2xl font-bold gap-2 self-end md:self-auto"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                  <span>รีเฟรช</span>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`btn btn-sm h-10 px-4 rounded-xl font-bold ${
                    selectedCategory === "ALL"
                      ? "btn-primary text-primary-content"
                      : "btn-ghost bg-base-200"
                  }`}
                >
                  ทั้งหมด ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter(
                    (p) => p.category_id === cat.id
                  ).length;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`btn btn-sm h-10 px-4 rounded-xl font-bold ${
                        isSelected
                          ? "btn-primary text-primary-content"
                          : "btn-ghost bg-base-200"
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className="btn btn-sm btn-ghost border border-dashed border-base-300 h-10 px-3 rounded-xl font-bold gap-1 text-primary"
                  title="จัดการหมวดหมู่สินค้า"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>จัดการหมวดหมู่</span>
                </button>
              </div>
            </div>

            {/* Product Table Card */}
            <div className="card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto p-4">
                {isLoading ? (
                  <div className="text-center py-16">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-lg font-bold mt-2 text-base-content/70">
                      กำลังโหลดข้อมูลแคตตาล็อก...
                    </p>
                  </div>
                ) : error ? (
                  <div className="alert alert-error rounded-2xl font-bold text-center">
                    {error}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-16 text-base-content/50">
                    <p className="text-xl font-bold">
                      ไม่พบสินค้าในเงื่อนไขที่เลือก
                    </p>
                    <p className="text-sm mt-1">
                      ลองเปลี่ยนหมวดหมู่ หรือกดปุ่ม &quot;เพิ่มสินค้าใหม่&quot;
                    </p>
                  </div>
                ) : (
                  <table className="table table-zebra w-full text-base">
                    <thead>
                      <tr className="border-b-2 border-base-300 text-sm font-bold text-base-content/70">
                        <th className="w-16">รูป</th>
                        <th>รหัส / บาร์โค้ด</th>
                        <th>ชื่อสินค้า</th>
                        <th>หมวดหมู่</th>
                        <th className="text-right">ราคาขาย</th>
                        <th className="text-right">ต้นทุน</th>
                        <th>สถานะ</th>
                        <th className="text-center">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p) => {
                        const priceSatang = p.price ?? p.unit_price ?? 0;
                        const costSatang = p.cost_price ?? 0;
                        const catName =
                          categories.find((c) => c.id === p.category_id)
                            ?.name ||
                          p.category?.name ||
                          "-";

                        return (
                          <tr key={p.id} className="hover">
                            <td>
                              <div className="w-12 h-12 rounded-xl bg-base-200 overflow-hidden flex items-center justify-center">
                                {p.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-base-content/30" />
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="font-mono font-bold text-sm text-base-content">
                                {p.code}
                              </div>
                              <div className="font-mono text-xs text-base-content/60 flex items-center gap-1">
                                {p.barcode && (
                                  <Barcode className="w-3.5 h-3.5" />
                                )}
                                <span>{p.barcode || "-"}</span>
                              </div>
                            </td>
                            <td className="font-bold text-base text-base-content">
                              {p.name}
                            </td>
                            <td>
                              <span className="badge badge-ghost font-bold text-xs gap-1">
                                <Tag className="w-3 h-3" />
                                {catName}
                              </span>
                            </td>
                            <td className="text-right font-black text-primary text-lg">
                              {formatBaht(priceSatang)}
                            </td>
                            <td className="text-right font-semibold text-base-content/70">
                              {costSatang > 0 ? formatBaht(costSatang) : "-"}
                            </td>
                            <td>
                              {p.is_active !== false ? (
                                <span className="badge badge-success text-white font-bold text-xs gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  เปิดขาย
                                </span>
                              ) : (
                                <span className="badge badge-ghost text-base-content/50 font-bold text-xs gap-1">
                                  <XCircle className="w-3 h-3" />
                                  ปิดการขาย
                                </span>
                              )}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                onClick={() => handleEdit(p)}
                                className="btn btn-sm btn-outline font-bold rounded-xl gap-1.5"
                              >
                                <Edit className="w-4 h-4" />
                                <span>แก้ไข</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Categories */}
        {activeTab === "categories" && (
          <div className="space-y-6">
            {/* Search & Actions Card */}
            <div className="card bg-base-100 border-2 border-base-300 p-4 rounded-3xl shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                {/* Search */}
                <div className="relative w-full md:w-96">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="ค้นหาชื่อหมวดหมู่สินค้า..."
                    className="input input-bordered w-full h-12 pl-11 pr-4 font-bold rounded-2xl"
                  />
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {!isAdmin && (
                    <span className="badge badge-warning text-xs font-bold py-3 px-3 rounded-xl gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      เฉพาะผู้ดูแลระบบ (Admin)
                      จึงจะสามารถเพิ่ม/แก้ไข/ลบหมวดหมู่ได้
                    </span>
                  )}
                  {/* Refresh */}
                  <button
                    type="button"
                    onClick={loadData}
                    disabled={isLoading}
                    className="btn btn-outline h-12 px-4 rounded-2xl font-bold gap-2"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                    />
                    <span>รีเฟรช</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Table Card */}
            <div className="card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto p-4">
                {isLoading ? (
                  <div className="text-center py-16">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-lg font-bold mt-2 text-base-content/70">
                      กำลังโหลดข้อมูลหมวดหมู่...
                    </p>
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="text-center py-16 text-base-content/50">
                    <p className="text-xl font-bold">ไม่พบหมวดหมู่สินค้า</p>
                    <p className="text-sm mt-1">
                      {categorySearch
                        ? "ลองเปลี่ยนคำค้นหา"
                        : 'กดปุ่ม "เพิ่มหมวดหมู่ใหม่" ด้านบนเพื่อสร้างหมวดหมู่แรก'}
                    </p>
                  </div>
                ) : (
                  <table className="table table-zebra w-full text-base">
                    <thead>
                      <tr className="border-b-2 border-base-300 text-sm font-bold text-base-content/70">
                        <th className="w-24 text-center">ลำดับ (Sort)</th>
                        <th>ชื่อหมวดหมู่</th>
                        <th>จำนวนสินค้า</th>
                        <th>รหัสอ้างอิง (UUID)</th>
                        <th className="text-center">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.map((cat) => {
                        const productCount = products.filter(
                          (p) => p.category_id === cat.id
                        ).length;

                        return (
                          <tr key={cat.id} className="hover">
                            <td className="text-center font-mono font-bold text-base text-primary">
                              <span className="badge badge-ghost font-mono font-bold px-3 py-2 text-sm rounded-lg">
                                {cat.sort_order ?? 0}
                              </span>
                            </td>
                            <td>
                              <div className="font-bold text-base text-base-content flex items-center gap-2">
                                <Tag className="w-4 h-4 text-primary" />
                                <span>{cat.name}</span>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-neutral text-xs font-bold gap-1 px-2.5 py-2 rounded-xl">
                                <Package className="w-3.5 h-3.5" />
                                {productCount} รายการ
                              </span>
                            </td>
                            <td>
                              <span className="font-mono text-xs text-base-content/50">
                                {cat.id}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditCategory(cat)}
                                  disabled={!isAdmin}
                                  title={
                                    !isAdmin
                                      ? "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น"
                                      : "แก้ไขข้อมูลหมวดหมู่"
                                  }
                                  className="btn btn-sm btn-outline font-bold rounded-xl gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>แก้ไข</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteCategoryPrompt(cat)
                                  }
                                  disabled={!isAdmin}
                                  title={
                                    !isAdmin
                                      ? "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น"
                                      : "ลบหมวดหมู่นี้"
                                  }
                                  className="btn btn-sm btn-outline btn-error font-bold rounded-xl gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>ลบ</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadData}
      />

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={isCategoryModalOpen}
        category={editingCategory}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Delete Category Confirmation Dialog */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-3xl max-w-md w-full border-2 border-error/30 shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-error">
              <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-xl text-base-content">
                  ยืนยันการลบหมวดหมู่
                </h3>
                <p className="text-xs font-semibold text-base-content/60">
                  การดำเนินการนี้ไม่สามารถยกเลิกได้
                </p>
              </div>
            </div>

            <div className="bg-base-200/60 p-4 rounded-2xl space-y-2 text-sm">
              <p className="font-bold text-base-content">
                คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่{" "}
                <span className="text-error font-black">
                  &ldquo;{deletingCategory.name}&rdquo;
                </span>
                ?
              </p>
              <p className="text-xs text-base-content/70">
                * ข้อควรระวัง: หากมีสินค้าที่อยู่ในหมวดหมู่นี้
                ระบบจะปลดหมวดหมู่ออกจากสินค้าดังกล่าวโดยอัตโนมัติ
                (สินค้าจะไม่ถูกลบออกจากระบบ)
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isDeleting}
                className="btn btn-ghost h-12 px-5 rounded-2xl font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                disabled={isDeleting}
                className="btn btn-error text-white h-12 px-6 rounded-2xl font-black gap-2 shadow-sm"
              >
                {isDeleting ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                <span>ยืนยันลบหมวดหมู่</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
