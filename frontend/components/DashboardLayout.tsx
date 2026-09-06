"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { notifications } from "@/lib/api";
import {
  Home,
  Briefcase,
  MessageCircle,
  Map,
  FileText,
  Settings,
  Menu,
  X,
  Bell,
  BellDot,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  rightPanel,
}: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState<
    {
      id: string;
      title: string;
      message: string;
      read: boolean;
      created_at: string;
    }[]
  >([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const unreadCount = notifList.filter((n) => !n.read).length;

  useEffect(() => {
    setNotifLoading(true);
    notifications
      .list()
      .then((data) => setNotifList(Array.isArray(data) ? data : []))
      .catch(() => setNotifList([]))
      .finally(() => setNotifLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await notifications.markRead(id);
      setNotifList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch {
      /* silent */
    }
  };

  const markAllRead = async () => {
    try {
      await notifications.markAllRead();
      setNotifList((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* silent */
    }
  };

  const navItems = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/roadmap", icon: Map, label: "Roadmap" },
    { href: "/chat", icon: MessageCircle, label: "Chat" },
    { href: "/opportunities", icon: Briefcase, label: "Opportunities" },
    { href: "/resume", icon: FileText, label: "Resume" },
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-50 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-0.5 text-xl font-bold"
          >
            <span className="text-black">LYNK</span>
            <span className="text-purple-600 font-black">S</span>
            <span className="text-purple-600 text-sm -ml-0.5">∞</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === item.href ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <item.icon className="w-4 h-4" /> {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-gray-100">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === "/settings" ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <Settings className="w-4 h-4" /> Settings
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
              >
                {unreadCount > 0 ? (
                  <BellDot className="w-5 h-5 text-purple-600" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-purple-600 hover:text-purple-700"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {notifLoading ? (
                        <div className="p-4 text-center text-sm text-gray-400">
                          Loading...
                        </div>
                      ) : notifList.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-400">
                          No notifications
                        </div>
                      ) : (
                        notifList.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              if (!n.read) markRead(n.id);
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? "bg-purple-50/50" : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span className="w-2 h-2 bg-purple-600 rounded-full mt-1.5 shrink-0" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {n.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {n.message}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User */}
            <Link
              href="/settings"
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-sm">
                {user?.name?.[0]?.toUpperCase() ??
                  user?.email?.[0]?.toUpperCase() ??
                  "U"}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user?.name ?? user?.email ?? "User"}
              </span>
            </Link>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
          {rightPanel && (
            <aside className="hidden lg:block w-72 border-l border-gray-100 overflow-y-auto bg-white">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
