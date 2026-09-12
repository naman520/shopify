import React, { useState, useEffect } from "react";
import { X, Key, Info, Eye, EyeOff, Save, Loader2, CheckCircle2, RefreshCw } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [domain, setDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiVersion, setApiVersion] = useState("2026-07");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fetch current config status on open
  useEffect(() => {
    if (isOpen) {
      const loadCurrentConfig = async () => {
        try {
          const res = await fetch("/api/config");
          if (res.ok) {
            const data = await res.json();
            if (data.domain) setDomain(data.domain);
            if (data.apiVersion) setApiVersion(data.apiVersion);
            
            // For security, if credentials are set, show masked placeholder
            if (data.hasClientCredentials) {
              setClientId("••••••••••••••••••••••••••••••••");
              setClientSecret("••••••••••••••••••••••••••••••••");
            }
          }
        } catch (err) {
          console.error("Error loading config status:", err);
        }
      };
      loadCurrentConfig();
      setError("");
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const payload: Record<string, string> = {
        domain,
        apiVersion,
      };

      // Only send Client ID if not the masked placeholder
      if (clientId && clientId !== "••••••••••••••••••••••••••••••••") {
        payload.clientId = clientId;
      } else if (!clientId) {
        throw new Error("Client ID is required.");
      }

      // Only send Client Secret if not the masked placeholder
      if (clientSecret && clientSecret !== "••••••••••••••••••••••••••••••••") {
        payload.clientSecret = clientSecret;
      } else if (!clientSecret) {
        throw new Error("Client Secret is required.");
      }

      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save configuration.");
      }

      setSuccess(true);
      onSaved();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center alignment trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal content */}
        <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200">
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                  <Key className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-6" id="modal-title">
                  Shopify Connection Settings
                </h3>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-500 rounded-lg p-1 hover:bg-slate-50 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Domain field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Shopify Store Domain
                </label>
                <input
                  type="text"
                  required
                  placeholder="your-store.myshopify.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                />
              </div>

              {/* Client ID field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Client ID (API Key)
                </label>
                <input
                  type="text"
                  required
                  placeholder="2e614b60a854f43a5265c1d1a2226702"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                />
              </div>

              {/* Client Secret field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Client Secret (Secret Key)
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    required
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-500 focus:outline-none"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* API Version field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  API Version
                </label>
                <select
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm cursor-pointer"
                >
                  <option value="2026-07">2026-07 (Latest / Active)</option>
                  <option value="2026-04">2026-04</option>
                  <option value="2026-01">2026-01</option>
                  <option value="2025-10">2025-10</option>
                </select>
              </div>

              {/* Status alerts */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Credentials saved & verified! Token generated.</span>
                </div>
              )}

              {/* Info Box */}
              <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-900 space-y-2">
                <h4 className="text-xs font-bold flex items-center gap-1.5 text-indigo-800">
                  <RefreshCw className="h-4 w-4 text-indigo-600 shrink-0" />
                  Automatic 24h Token Refresh Active
                </h4>
                <p className="text-[11px] leading-relaxed text-indigo-800">
                  Enter your store's <strong>Client ID</strong> and <strong>Client Secret</strong>. The server will automatically call the <code>/admin/oauth/access_token</code> API behind the scenes whenever the token expires, keeping your dashboard working with zero manual effort!
                </p>
              </div>

              {/* Form Actions */}
              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || success}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Credentials</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
