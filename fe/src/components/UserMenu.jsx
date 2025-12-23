import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { safeUpperInitial } from "../utils/format.js";
import "./Header.css";

export default function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const label = useMemo(() => user?.username || user?.email || "Guest", [user]);
  const initial = useMemo(() => safeUpperInitial(label), [label]);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="userMenu" ref={ref}>
      {isAuthenticated ? (
        <button className="userMenuBtn" type="button" onClick={() => setOpen((v) => !v)}>
          <span className="avatar">{initial}</span>
          <span className="userLabel" title={label}>
            {label}
          </span>
          <span className={open ? "caret caretOpen" : "caret"} aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link className="btn btnGhost" to="/login">
            Đăng nhập
          </Link>
          <Link className="btn btnPrimary" to="/register">
            Đăng ký
          </Link>
        </div>
      )}

      {isAuthenticated && open ? (
        <div className="dropdown">
          <div className="dropdownHeader">
            <div className="dropdownTitle">{label}</div>
            <div className="dropdownSub">{user?.email || ""}</div>
          </div>

          <Link className="dropdownItem" to="/profile" onClick={() => setOpen(false)}>
            <span className="dropdownIcon" aria-hidden>
              👤
            </span>
            Profile
          </Link>

          <Link className="dropdownItem" to="/orders" onClick={() => setOpen(false)}>
            <span className="dropdownIcon" aria-hidden>
              🧾
            </span>
            Hóa đơn
          </Link>

          <button className="dropdownItem danger" type="button" onClick={onLogout}>
            <span className="dropdownIcon" aria-hidden>
              ⎋
            </span>
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
