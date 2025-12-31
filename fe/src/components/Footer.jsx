import React from "react";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-left">
          <div className="footer-brand">Shop Dark</div>
          <div className="footer-muted">Giao diện demo cho dự án Web (React + API)</div>
        </div>

        <div className="footer-right">
          <a className="footer-link" href="https://localhost" onClick={(e) => e.preventDefault()}>
            Điều khoản
          </a>
          <a className="footer-link" href="https://localhost" onClick={(e) => e.preventDefault()}>
            Quyền riêng tư
          </a>
          <span className="footer-muted">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
