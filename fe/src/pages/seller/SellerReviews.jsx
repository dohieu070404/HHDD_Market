import { useEffect, useState } from "react";
import { sellerApi } from "../../api/seller";

import "./SellerReviews.css";

function StarRow({ rating }) {
  const r = Number(rating || 0);
  return (
    <div className="seller-reviews__stars" aria-label={`Rating ${r} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < r ? "seller-reviews__star seller-reviews__star--on" : "seller-reviews__star seller-reviews__star--off"}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function SellerReviews() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);

  const [replyDraft, setReplyDraft] = useState({}); // { [reviewId]: text }
  const [followUpDraft, setFollowUpDraft] = useState({}); // { [reviewId]: text }
  const [submittingId, setSubmittingId] = useState(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    const res = await sellerApi.listReviews();
    if (res?.success) {
      const nextItems = res.data || [];
      setItems(nextItems);
      // Prefill reply drafts with existing reply (if any)
      const drafts = {};
      const follow = {};
      nextItems.forEach((r) => {
        drafts[r.id] = r.replies?.[0]?.content || "";
        follow[r.id] = "";
      });
      setReplyDraft(drafts);
      setFollowUpDraft(follow);
    } else {
      setItems([]);
      setMsg(res?.message || "Không tải được đánh giá");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitReply(reviewId) {
    const content = (replyDraft[reviewId] || "").trim();
    if (content.length < 2) {
      setMsg("Vui lòng nhập phản hồi (tối thiểu 2 ký tự).");
      return;
    }
    setSubmittingId(reviewId);
    setMsg(null);
    const res = await sellerApi.replyReview(reviewId, content);
    if (res?.success) {
      await load();
      setMsg(res?.message || "Đã lưu phản hồi.");
    } else {
      setMsg(res?.message || "Không gửi được phản hồi.");
    }
    setSubmittingId(null);
  }

  async function submitFollowUp(reviewId) {
    const content = (followUpDraft[reviewId] || "").trim();
    if (content.length < 2) {
      setMsg("Vui lòng nhập phản hồi (tối thiểu 2 ký tự).");
      return;
    }
    setSubmittingId(`follow_${reviewId}`);
    setMsg(null);
    const res = await sellerApi.followUpReview(reviewId, content);
    if (res?.success) {
      setFollowUpDraft((s) => ({ ...s, [reviewId]: "" }));
      await load();
      setMsg("Đã gửi phản hồi thêm.");
    } else {
      setMsg(res?.message || "Không gửi được phản hồi thêm.");
    }
    setSubmittingId(null);
  }

  async function reportReview(reviewId) {
    const reason = window.prompt("Lý do báo cáo đánh giá (tuỳ chọn):", "Nội dung không phù hợp");
    if (!reason) return;
    const res = await sellerApi.reportReview(reviewId, reason);
    if (res?.success) {
      setMsg("Đã gửi báo cáo.");
      await load();
    } else {
      setMsg(res?.message || "Không báo cáo được.");
    }
  }

  return (
    <section className="seller-reviews">
      <header className="seller-reviews__header">
        <div>
          <h1 className="seller-reviews__title">Đánh giá sản phẩm</h1>
          <p className="seller-reviews__subtitle muted">Xem và phản hồi đánh giá của khách hàng.</p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading} type="button">
          Tải lại
        </button>
      </header>

      {msg ? <div className="card seller-reviews__msg">{msg}</div> : null}

      {loading ? (
        <div className="card seller-reviews__loading">Đang tải...</div>
      ) : items.length ? (
        <div className="seller-reviews__list">
          {items.map((r) => {
            const rep0 = r.replies?.[0];
            const canEditReply = !rep0 || Number(rep0.editCount || 0) < 1;
            const canSellerFollowUp = !!r.buyerFollowUp && !r.sellerFollowUp;

            return (
              <article key={r.id} className="card seller-reviews__card">
                <div className="seller-reviews__top">
                  <div>
                    <div className="seller-reviews__product">{r.product?.name}</div>
                    <div className="seller-reviews__meta muted">
                      {r.user?.username || "Khách"} • {new Date(r.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="seller-reviews__topRight">
                    <StarRow rating={r.rating} />
                    <button className="btn-secondary seller-reviews__report" onClick={() => reportReview(r.id)} type="button">
                      Báo cáo
                    </button>
                  </div>
                </div>

                <div className="seller-reviews__content">{r.content || "(Không có nội dung)"}</div>

                {r.replies?.length ? (
                  <div className="seller-reviews__block">
                    <div className="seller-reviews__blockTitle">Phản hồi của shop</div>
                    <div className="seller-reviews__replyList">
                      {r.replies.map((rep) => (
                        <div key={rep.id} className="seller-reviews__reply">
                          <div className="seller-reviews__replyMeta muted">
                            {rep.shop?.name || "Shop"} • {new Date(rep.createdAt).toLocaleString("vi-VN")}
                          </div>
                          <div className="seller-reviews__replyBody">{rep.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {r.buyerFollowUp ? (
                  <div className="seller-reviews__block">
                    <div className="seller-reviews__blockTitle">Phản hồi thêm từ người mua</div>
                    <div className="seller-reviews__followUp">{r.buyerFollowUp.content}</div>
                  </div>
                ) : null}

                {r.sellerFollowUp ? (
                  <div className="seller-reviews__block">
                    <div className="seller-reviews__blockTitle">Phản hồi thêm của shop</div>
                    <div className="seller-reviews__followUp">{r.sellerFollowUp.content}</div>
                  </div>
                ) : null}

                <div className="seller-reviews__block">
                  <div className="seller-reviews__blockTitle">Phản hồi (shop)</div>
                  {rep0 && !canEditReply ? (
                    <div className="seller-reviews__hint">Bạn đã chỉnh sửa phản hồi 1 lần. Không thể sửa thêm.</div>
                  ) : rep0 ? (
                    <div className="seller-reviews__hint">Bạn có thể chỉnh sửa phản hồi 1 lần nếu cần.</div>
                  ) : (
                    <div className="seller-reviews__hint">Hãy phản hồi lịch sự và rõ ràng để giữ trải nghiệm tốt.</div>
                  )}
                  <textarea
                    className="textarea seller-reviews__textarea"
                    rows={3}
                    value={replyDraft[r.id] || ""}
                    onChange={(e) => setReplyDraft((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder="Nhập phản hồi của shop..."
                    disabled={!canEditReply}
                  />
                  <div className="seller-reviews__actions">
                    <button
                      className="btn-primary"
                      onClick={() => submitReply(r.id)}
                      disabled={!canEditReply || submittingId === r.id}
                      type="button"
                    >
                      {submittingId === r.id ? "Đang lưu..." : "Lưu phản hồi"}
                    </button>
                  </div>
                </div>

                {canSellerFollowUp ? (
                  <div className="seller-reviews__block">
                    <div className="seller-reviews__blockTitle">Phản hồi thêm (1 lần)</div>
                    <div className="seller-reviews__hint">Chỉ dùng khi đã trao đổi với khách hàng và muốn cập nhật kết luận.</div>
                    <textarea
                      className="textarea seller-reviews__textarea"
                      rows={3}
                      value={followUpDraft[r.id] || ""}
                      onChange={(e) => setFollowUpDraft((s) => ({ ...s, [r.id]: e.target.value }))}
                      placeholder="Nhập phản hồi thêm..."
                    />
                    <div className="seller-reviews__actions">
                      <button
                        className="btn-primary"
                        onClick={() => submitFollowUp(r.id)}
                        disabled={submittingId === `follow_${r.id}`}
                        type="button"
                      >
                        {submittingId === `follow_${r.id}` ? "Đang gửi..." : "Gửi phản hồi thêm"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card seller-reviews__loading">Chưa có đánh giá nào.</div>
      )}
    </section>
  );
}
