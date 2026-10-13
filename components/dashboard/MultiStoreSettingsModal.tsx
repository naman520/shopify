import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Save,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { ShopifyConfigResponse, ShopifyStoreSummary } from "@/types/shopify";

const MASK = "••••••••••••••••••••••••••••••••";

interface StoreDraft {
  id?: string;
  name: string;
  domain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  isConfigured?: boolean;
  environmentManaged?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (storeId?: string) => void;
}

function toDraft(store: ShopifyStoreSummary): StoreDraft {
  return {
    id: store.id,
    name: store.name,
    domain: store.domain,
    clientId: store.hasClientCredentials ? MASK : "",
    clientSecret: store.hasClientCredentials ? MASK : "",
    apiVersion: store.apiVersion || "2026-10",
    isConfigured: store.isConfigured,
    environmentManaged: store.environmentManaged,
  };
}

const emptyDraft = (number: number): StoreDraft => ({
  name: `Store ${number}`,
  domain: "",
  clientId: "",
  clientSecret: "",
  apiVersion: "2026-10",
});

export const MultiStoreSettingsModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const [stores, setStores] = useState<StoreDraft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStores = async () => {
    setLoadingStores(true);
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      const data: ShopifyConfigResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load stores.");
      const drafts = (data.stores || []).map(toDraft);
      setStores(drafts.length ? drafts : [emptyDraft(1)]);
      setActiveIndex((current) => Math.min(current, Math.max(0, drafts.length - 1)));
    } catch (err: any) {
      setError(err.message || "Unable to load stores.");
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSuccess("");
    setActiveIndex(0);
    loadStores();
  }, [isOpen]);

  if (!isOpen) return null;

  const activeStore = stores[activeIndex] || emptyDraft(activeIndex + 1);
  const updateActive = (field: keyof StoreDraft, value: string) => {
    setStores((current) =>
      current.map((store, index) =>
        index === activeIndex ? { ...store, [field]: value } : store
      )
    );
    setError("");
    setSuccess("");
  };

  const addStore = () => {
    if (stores.length >= 2) return;
    setStores((current) => [...current, emptyDraft(current.length + 1)]);
    setActiveIndex(stores.length);
    setError("");
    setSuccess("");
  };

  const saveStore = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeStore.environmentManaged) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, string> = {
        name: activeStore.name.trim(),
        domain: activeStore.domain.trim(),
        apiVersion: activeStore.apiVersion,
      };
      if (activeStore.id) payload.storeId = activeStore.id;
      if (activeStore.clientId && activeStore.clientId !== MASK) {
        payload.clientId = activeStore.clientId;
      }
      if (activeStore.clientSecret && activeStore.clientSecret !== MASK) {
        payload.clientSecret = activeStore.clientSecret;
      }

      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save this store.");

      setSuccess(`${data.store?.name || "Store"} connected successfully.`);
      await loadStores();
      onSaved(data.store?.id);
    } catch (err: any) {
      setError(err.message || "Unable to save this store.");
    } finally {
      setLoading(false);
    }
  };

  const removeStore = async () => {
    if (!activeStore.id || !window.confirm(`Remove ${activeStore.name} from this dashboard?`)) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/config?storeId=${encodeURIComponent(activeStore.id)}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove store.");
      setActiveIndex(0);
      await loadStores();
      onSaved();
    } catch (err: any) {
      setError(err.message || "Unable to remove store.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        <button
          className="fixed inset-0 h-full w-full bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close settings"
        />
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>

        <div className="relative inline-block w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white text-left align-bottom shadow-xl sm:my-8 sm:align-middle">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Shopify Stores</h2>
                <p className="text-xs text-slate-500">Connect and manage up to two stores.</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 py-5">
            {loadingStores ? (
              <div className="flex h-64 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading stores...
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  {stores.map((store, index) => (
                    <button
                      key={store.id || `new-${index}`}
                      type="button"
                      onClick={() => {
                        setActiveIndex(index);
                        setError("");
                        setSuccess("");
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        activeIndex === index
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Store className="h-4 w-4" />
                      {store.name || `Store ${index + 1}`}
                      {store.isConfigured && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    </button>
                  ))}
                  {stores.length < 2 &&
                    stores.every((store) => Boolean(store.id) && !store.environmentManaged) && (
                    <button
                      type="button"
                      onClick={addStore}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <Plus className="h-4 w-4" /> Add second store
                    </button>
                  )}
                </div>

                {activeStore.environmentManaged && (
                  <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-800">
                    This store is managed by <strong>Vercel Environment Variables</strong>.
                    Update the variables in Vercel and redeploy to change this connection.
                  </div>
                )}

                <form onSubmit={saveStore} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Store name</span>
                    <input
                      required
                      disabled={activeStore.environmentManaged}
                      value={activeStore.name}
                      onChange={(event) => updateActive("name", event.target.value)}
                      placeholder="Main Store"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Store domain</span>
                    <input
                      required
                      disabled={activeStore.environmentManaged}
                      value={activeStore.domain}
                      onChange={(event) => updateActive("domain", event.target.value)}
                      placeholder="your-store.myshopify.com"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Client ID</span>
                    <input
                      required
                      disabled={activeStore.environmentManaged}
                      value={activeStore.clientId}
                      onChange={(event) => updateActive("clientId", event.target.value)}
                      placeholder="Shopify Client ID"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Client secret</span>
                    <span className="relative block">
                      <input
                        required
                        disabled={activeStore.environmentManaged}
                        type={showSecret ? "text" : "password"}
                        value={activeStore.clientSecret}
                        onChange={(event) => updateActive("clientSecret", event.target.value)}
                        placeholder="Shopify Client Secret"
                        className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-10 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={activeStore.environmentManaged}
                        onClick={() => setShowSecret((value) => !value)}
                        className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">API version</span>
                    <select
                      value={activeStore.apiVersion}
                      disabled={activeStore.environmentManaged}
                      onChange={(event) => updateActive("apiVersion", event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="2026-10">2026-10 (Latest)</option>
                      <option value="2026-07">2026-07</option>
                      <option value="2026-04">2026-04</option>
                      <option value="2026-01">2026-01</option>
                      <option value="2025-10">2025-10</option>
                    </select>
                  </label>

                  {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 sm:col-span-2">{error}</div>}
                  {success && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 sm:col-span-2">
                      <CheckCircle2 className="h-4 w-4" /> {success}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 sm:col-span-2">
                    <div>
                      {activeStore.id && stores.length > 1 && !activeStore.environmentManaged && (
                        <button
                          type="button"
                          onClick={removeStore}
                          disabled={loading || deleting}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
                      <button
                        type="submit"
                        disabled={loading || deleting || activeStore.environmentManaged}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {activeStore.environmentManaged
                          ? "Managed by Vercel"
                          : loading
                            ? "Verifying..."
                            : "Save & verify"}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
