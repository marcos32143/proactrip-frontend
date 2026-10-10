"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { User, UserCircle, LogOut, LogIn, FileText, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContext";
import { useEnvironment } from "@/hooks/useEnvironment";

interface ProfileDropdownProps {
  isLanding?: boolean;
}

export default function ProfileDropdown({
  isLanding = false,
}: ProfileDropdownProps) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { user, profileFirstName, profileAvatar } = useAuthContext();
  const { environment } = useEnvironment();
  const router = useRouter();
  const [avatarError, setAvatarError] = useState(false);

  const userName = profileFirstName ?? (user?.email ? user.email.split("@")[0] : null);

  const locationLine = environment?.location
    ? `${environment.location.city || ""}, ${environment.location.country_code || ""}`
    : null;

  return (
    <Menu>
      <MenuButton
        className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden transition-colors ${
          isLanding
            ? "border border-white/25 text-white hover:bg-white/15 data-[open]:bg-white/20"
            : "border border-[#e5e5e5] text-[#0A0A0A] hover:bg-[#F5F5F5] data-[open]:bg-[#F5F5F5]"
        }`}
        aria-label="Cuenta de usuario"
      >
        {profileAvatar && !avatarError ? (
          <Image
            src={profileAvatar}
            alt=""
            width={36}
            height={36}
            className="w-full h-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <User className="w-[18px] h-[18px]" />
        )}
      </MenuButton>

      <MenuItems
        anchor={{ to: "bottom end", gap: 8 }}
        transition
        className="w-[280px] bg-white rounded-2xl shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] border border-[#E5E7EB] p-2 z-[1000] origin-top-right transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {isLoading ? (
          <div className="flex items-center gap-3 px-3 py-4">
            <div className="w-10 h-10 rounded-full bg-[#F5F5F5] animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-24 h-4 bg-[#F5F5F5] rounded animate-pulse" />
              <div className="w-16 h-3 bg-[#F5F5F5] rounded animate-pulse" />
            </div>
          </div>
        ) : isAuthenticated ? (
          <>
            {/* USER HEADER */}
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="w-10 h-10 rounded-full bg-[#F5F5F5] overflow-hidden flex items-center justify-center shrink-0">
                {profileAvatar && !avatarError ? (
                  <Image
                    src={profileAvatar}
                    alt=""
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <User className="w-5 h-5 text-[#6A7282]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0A0A0A] truncate">
                  {userName || "Usuario"}
                </p>
                {locationLine && (
                  <p className="text-[13px] text-[#6A7282] truncate">
                    {locationLine}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-[#F5F5F5] my-1" />

            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={() => router.push("/perfil")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    focus ? "bg-[#FAFAFA]" : ""
                  }`}
                >
                  <UserCircle className="w-[18px] h-[18px] text-[#6A7282]" />
                  <span className="text-[14px] text-[#0A0A0A]">Perfil</span>
                </button>
              )}
            </MenuItem>

            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={() => router.push("/documentos")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    focus ? "bg-[#FAFAFA]" : ""
                  }`}
                >
                  <FileText className="w-[18px] h-[18px] text-[#6A7282]" />
                  <span className="text-[14px] text-[#0A0A0A]">Documentos</span>
                </button>
              )}
            </MenuItem>

            {(user?.permissions?.includes('users:read') || user?.role_name === 'admin') && (
              <MenuItem>
                {({ focus }) => (
                  <button
                    onClick={() => router.push("/admin")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      focus ? "bg-[#FAFAFA]" : ""
                    }`}
                  >
                    <LayoutDashboard className="w-[18px] h-[18px] text-[#6A7282]" />
                    <span className="text-[14px] text-[#0A0A0A]">
                      Panel de Administración
                    </span>
                  </button>
                )}
              </MenuItem>
            )}

            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={logout}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    focus ? "bg-[#FAFAFA]" : ""
                  }`}
                >
                  <LogOut className="w-[18px] h-[18px] text-[#6A7282]" />
                  <span className="text-[14px] text-[#0A0A0A]">
                    Cerrar sesión
                  </span>
                </button>
              )}
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={() => router.push("/auth/login")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    focus ? "bg-[#FAFAFA]" : ""
                  }`}
                >
                  <LogIn className="w-[18px] h-[18px] text-[#6A7282]" />
                  <span className="text-[14px] text-[#0A0A0A]">
                    Iniciar sesión
                  </span>
                </button>
              )}
            </MenuItem>

            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={() => router.push("/auth/register")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    focus ? "bg-[#FAFAFA]" : ""
                  }`}
                >
                  <User className="w-[18px] h-[18px] text-[#6A7282]" />
                  <span className="text-[14px] text-[#0A0A0A]">
                    Registrarse
                  </span>
                </button>
              )}
            </MenuItem>
          </>
        )}
      </MenuItems>
    </Menu>
  );
}
