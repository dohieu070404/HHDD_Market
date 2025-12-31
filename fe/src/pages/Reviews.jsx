import { useEffect, useMemo, useRef, useState } from "react";
import "./Reviews.css";
import { Link, useLocation } from "react-router-dom";
import { customerApi } from "../api/customer";
import { useToast } from "../contexts/ToastContext";
import RatingStars from "../components/ui/RatingStars";
import Modal from "../components/ui/Modal";
import { formatDateTime } from "../utils/format";

function StarPicker({ value, onChange }) {
  const v = Number(value || 0);

  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= v;
        return (
          <button
            key={n}
            type="button"
            className={"star-picker__btn " + (active ? "star-picker__btn--active" : "star-picker__btn--inactive")}
            onClick={() => onChange(n)}
            title={`${n} sao`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}


function ReviewSkeleton() {
  return (
    <div className="reviews-skeleton">
      <div className="skeleton reviews-skeleton__title" />
      <div className="skeleton reviews-skeleton__card" />
      <div className="skeleton reviews-skeleton__card" />
    </div>
  );
}

export default function Reviews() {
  const loc = useLocation();
  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const qOrder = qs.get("order") || "";
  const qProductId = qs.get("productId") || qs.get("product") || "";

  const { push } = useToast();

  const [tab, setTab] = useState("PENDING"); // PENDING | DONE
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState([]); // [{order,item}]
  const [myReviews, setMyReviews] = useState([]); // list

  const [modal, setModal] = useState(null); // {mode:'create'|'edit'|'followup', payload}
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Review images (upload first -> send urls in payload)
  const [existingMediaUrls, setExistingMediaUrls] = useState([]); // string[]
  const [newMedia, setNewMedia] = useState([]); // [{file, previewUrl}]
  const previewUrlsRef = useRef(new Set());

  const didAutoOpen = useRef(false);

  useEffect(() => {
    return () => {
      try {
        previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      } catch {
        // ignore
      }
      previewUrlsRef.current.clear();
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [ordersRes, reviewsRes] = await Promise.all([
        customerApi.listOrders({ status: "DELIVERED,COMPLETED", page: 1, limit: 50 }),
        customerApi.listMyReviews({ page: 1, limit: 100 }),
      ]);

      const orders = ordersRes?.data?.items || [];
      const pend = [];

      for (const o of orders) {
        for (const it of o.items || []) {
          if (!it.hasReview) {
            pend.push({ order: o, item: it });
          }
        }
      }

      if (qOrder) {
        pend.sort((a, b) => {
          if (a.order.code === qOrder && b.order.code !== qOrder) return -1;
          if (a.order.code !== qOrder && b.order.code === qOrder) return 1;
          return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
        });
      }

      setPending(pend);
      setMyReviews(reviewsRes?.data?.items || reviewsRes?.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      try {
        previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      } catch {
        // ignore
      }
      previewUrlsRef.current.clear();
    };
  }, []);

  function clearMediaState() {
    // revoke previews
    (newMedia || []).forEach((m) => {
      try {
        URL.revokeObjectURL(m.previewUrl);
      } catch {
        // ignore
      }
      previewUrlsRef.current.delete(m.previewUrl);
    });
    setNewMedia([]);
    setExistingMediaUrls([]);
  }

  function addMediaFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const max = 6;
    const current = (existingMediaUrls || []).length + (newMedia || []).length;
    const remain = Math.max(0, max - current);
    const picked = files
      .filter((f) => f && f.type && f.type.startsWith("image/"))
      .slice(0, remain);

    const tooLarge = picked.find((f) => f.size > 4 * 1024 * 1024);
    if (tooLarge) {
      push({ type: "error", title: "Ảnh quá lớn", message: "Mỗi ảnh tối đa 4MB." });
      return;
    }

    const next = picked.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { file, previewUrl };
    });
    setNewMedia((prev) => [...(prev || []), ...next]);
  }

  function removeExistingMedia(idx) {
    setExistingMediaUrls((prev) => (prev || []).filter((_, i) => i !== idx));
  }

  function removeNewMedia(idx) {
    setNewMedia((prev) => {
      const arr = [...(prev || [])];
      const item = arr[idx];
      if (item?.previewUrl) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          // ignore
        }
        previewUrlsRef.current.delete(item.previewUrl);
      }
      arr.splice(idx, 1);
      return arr;
    });
  }

  useEffect(() => {
    if (didAutoOpen.current) return;
    if (!qOrder && !qProductId) return;
    if (!pending.length) return;

    const pid = qProductId ? Number(qProductId) : null;

    const target = pending.find((x) => {
      if (qOrder && x.order.code !== qOrder) return false;
      if (pid && Number(x.item.productId) !== pid) return false;
      return true;
    });

    if (target) {
      didAutoOpen.current = true;
      openCreate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length]);

  function openCreate(entry) {
    setRating(5);
    setContent("");
    setExistingMediaUrls([]);
    // clear old previews
    setNewMedia((prev) => {
      (prev || []).forEach((m) => {
        try {
          URL.revokeObjectURL(m.previewUrl);
        } catch {
          // ignore
        }
        previewUrlsRef.current.delete(m.previewUrl);
      });
      return [];
    });
    setModal({ mode: "create", payload: entry });
  }

  function openEdit(review) {
    setRating(Number(review.rating || 5));
    setContent(review.content || "");
    setExistingMediaUrls(Array.isArray(review.mediaUrls) ? review.mediaUrls : []);
    // clear old previews
    setNewMedia((prev) => {
      (prev || []).forEach((m) => {
        try {
          URL.revokeObjectURL(m.previewUrl);
        } catch {
          // ignore
        }
        previewUrlsRef.current.delete(m.previewUrl);
      });
      return [];
    });
    setModal({ mode: "edit", payload: review });
  }

  function openFollowUp(review) {
    clearMediaState();
    setContent("");
    setModal({ mode: "followup", payload: review });
  }

  async function submitCreate() {
    if (!modal?.payload) return;
    const entry = modal.payload;
    const productId = Number(entry.item.productId);
    if (!productId) return;

    if (!rating || rating < 1 || rating > 5) {
      push({ type: "error", title: "Thiếu thông tin", message: "Vui lòng chọn số sao (1–5)." });
      return;
    }

    setSubmitting(true);
    try {
      let uploadedUrls = [];
      if ((newMedia || []).length) {
        const up = await customerApi.uploadReviewImages((newMedia || []).map((m) => m.file));
        if (!up?.success) {
          throw new Error(up?.message || "Upload ảnh thất bại");
        }
        uploadedUrls = up?.data?.urls || [];
      }

      const mediaUrls = [...(existingMediaUrls || []), ...uploadedUrls];

      const res = await customerApi.createProductReview(productId, {
        rating,
        content,
        ...(mediaUrls.length ? { mediaUrls } : {}),
      });
      if (res?.success) {
        push({ type: "success", title: "Đã gửi đánh giá", message: "Cảm ơn bạn đã đánh giá sản phẩm!" });
        clearMediaState();
        setModal(null);
        await load();
        setTab("DONE");
      } else {
        push({ type: "error", title: "Không thể gửi", message: res?.message || "Vui lòng thử lại." });
      }
    } catch (e) {
      push({ type: "error", title: "Không thể gửi", message: e?.data?.message || "Vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    const review = modal?.payload;
    if (!review?.id) return;

    setSubmitting(true);
    try {
      let uploadedUrls = [];
      if ((newMedia || []).length) {
        const up = await customerApi.uploadReviewImages((newMedia || []).map((m) => m.file));
        if (!up?.success) {
          throw new Error(up?.message || "Upload ảnh thất bại");
        }
        uploadedUrls = up?.data?.urls || [];
      }

      const mediaUrls = [...(existingMediaUrls || []), ...uploadedUrls];

      const res = await customerApi.updateReview(review.id, { rating, content, mediaUrls });
      if (res?.success) {
        push({ type: "success", title: "Đã cập nhật", message: "Đánh giá đã được chỉnh sửa." });
        clearMediaState();
        setModal(null);
        await load();
      } else {
        push({ type: "error", title: "Không thể cập nhật", message: res?.message || "Vui lòng thử lại." });
      }
    } catch (e) {
      push({ type: "error", title: "Không thể cập nhật", message: e?.data?.message || "Vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFollowUp() {
    const review = modal?.payload;
    if (!review?.id) return;

    if (!content?.trim()) {
      push({ type: "error", title: "Thiếu nội dung", message: "Vui lòng nhập nội dung phản hồi." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await customerApi.followUpReview(review.id, content.trim());
      if (res?.success) {
        push({ type: "success", title: "Đã gửi phản hồi", message: "Shop sẽ nhận được phản hồi của bạn." });
        setModal(null);
        await load();
      } else {
        push({ type: "error", title: "Không thể gửi", message: res?.message || "Vui lòng thử lại." });
      }
    } catch (e) {
      push({ type: "error", title: "Không thể gửi", message: e?.data?.message || "Vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = pending.length;
  const doneCount = myReviews.length;

  return (
    <div className="reviews-page">
      <div className="container-page reviews-page__container">
        <div className="card reviews-card">
          <div className="reviews-header">
            <div>
              <h1 className="reviews-header__title">Trung tâm đánh giá</h1>
              <p className="muted reviews-header__subtitle">
                Tại đây bạn có thể <b>đánh giá</b>, <b>chỉnh sửa 1 lần</b> và <b>phản hồi thêm</b> (nếu shop đã trả lời).
              </p>
            </div>

            <div className="reviews-header__tabs">
              <button
                className={"btn btn-sm " + (tab === "PENDING" ? "btn-primary" : "btn-outline")}
                onClick={() => setTab("PENDING")}
              >
                Chưa đánh giá ({pendingCount})
              </button>
              <button
                className={"btn btn-sm " + (tab === "DONE" ? "btn-primary" : "btn-outline")}
                onClick={() => setTab("DONE")}
              >
                Đã đánh giá ({doneCount})
              </button>
            </div>
          </div>

          {loading ? (
            <ReviewSkeleton />
          ) : tab === "PENDING" ? (
            <div className="reviews-section">
              {pendingCount === 0 ? (
                <div className="reviews-empty muted">
                  Bạn chưa có sản phẩm nào cần đánh giá. <Link to="/orders" className="link">Xem đơn hàng</Link>
                </div>
              ) : (
                <div className="reviews-list">
                  {pending.map(({ order, item }) => (
                    <div key={String(order.code) + "-" + String(item.productId)} className="card reviews-item">
                      <div className="reviews-item__row">
                        <div className="reviews-item__left">
                          <div className="reviews-item__thumb">
                            <img
                              src={item.product?.thumbnailUrl || "/placeholder.png"}
                              alt={item.product?.name || "product"}
                              className="reviews-item__img"
                            />
                          </div>
                          <div className="reviews-item__info">
                            <div className="reviews-item__name">{item.product?.name || "Sản phẩm"}</div>
                            <div className="muted reviews-item__meta">
                              Đơn <b>{order.code}</b> • {order.shop?.name || "Shop"} • {formatDateTime(order.deliveredAt || order.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div className="reviews-item__actions">
                          <Link to={`/orders/o/${order.code}`} className="btn btn-outline btn-sm">
                            Xem đơn
                          </Link>
                          <button className="btn btn-primary btn-sm" onClick={() => openCreate({ order, item })}>
                            Đánh giá
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="reviews-section">
              {doneCount === 0 ? (
                <div className="reviews-empty muted">Bạn chưa có đánh giá nào.</div>
              ) : (
                <div className="reviews-list">
                  {myReviews.map((r) => (
                    <div key={r.id} className="card reviews-item">
                      <div className="reviews-item__row reviews-item__row--top">
                        <div className="reviews-item__left">
                          <div className="reviews-item__thumb reviews-item__thumb--sm">
                            <img
                              src={r.product?.thumbnailUrl || "/placeholder.png"}
                              alt={r.product?.name || "product"}
                              className="reviews-item__img"
                            />
                          </div>
                          <div className="reviews-item__info">
                            <Link className="reviews-item__nameLink" to={`/p/${r.product?.slug}`}>
                              {r.product?.name || "Sản phẩm"}
                            </Link>
                            <div className="muted reviews-item__meta">
                              {r.shop?.name ? (
                                <>
                                  Shop: <Link className="link" to={`/shop/${r.shop.slug}`}>{r.shop.name}</Link> •{" "}
                                </>
                              ) : null}
                              {formatDateTime(r.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div className="reviews-item__actions reviews-item__actions--stack">
                          <Link to={`/p/${r.product?.slug}`} className="btn btn-outline btn-sm">
                            Xem sản phẩm
                          </Link>
                          <button className="btn btn-outline btn-sm" disabled={Number(r.editCount || 0) >= 1} onClick={() => openEdit(r)}>
                            Sửa (1 lần)
                          </button>
                          <button className="btn btn-primary btn-sm" disabled={!r.replies?.length || !!r.buyerFollowUp} onClick={() => openFollowUp(r)}>
                            Phản hồi thêm
                          </button>
                          <div className="muted reviews-item__hint">
                            {Number(r.editCount || 0) >= 1 ? "Bạn đã sửa 1 lần." : "Chỉ được sửa 1 lần (7 ngày)."}
                          </div>
                        </div>
                      </div>

                      <div className="reviews-item__rating">
                        <RatingStars value={r.rating} />
                        <span className="muted reviews-item__ratingText">({r.rating}/5)</span>
                      </div>

                      {r.content ? <div className="reviews-item__content">{r.content}</div> : null}

                      {r.replies?.length ? (
                        <div className="complaint-reply reviews-item__reply">
                          <div className="reviews-reply__title">Shop phản hồi</div>
                          {r.replies.map((rp) => (
                            <div key={rp.id} className="reviews-reply__line">
                              <b>{rp.shop?.name || "Shop"}:</b> {rp.content}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {r.buyerFollowUp ? (
                        <div className="card reviews-followup">
                          <div className="muted reviews-followup__label">Bạn đã cập nhật</div>
                          <div className="reviews-followup__content">{r.buyerFollowUp.content}</div>
                        </div>
                      ) : null}

                      {r.sellerFollowUp ? (
                        <div className="card reviews-followup">
                          <div className="muted reviews-followup__label">Shop phản hồi thêm</div>
                          <div className="reviews-followup__content">{r.sellerFollowUp.content}</div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {modal?.mode === "create" ? (
          <Modal
            open
            title="Gửi đánh giá"
            onClose={() =>
              submitting
                ? null
                : (() => {
                    clearMediaState();
                    setModal(null);
                  })()
            }
          >
            <div className="reviews-modal__grid">
              <div className="card reviews-modalProduct">
                <div className="reviews-modalProduct__name">{modal.payload?.item?.product?.name || "Sản phẩm"}</div>
                <div className="muted reviews-modalProduct__meta">
                  Đơn <b>{modal.payload?.order?.code}</b> • {modal.payload?.order?.shop?.name || "Shop"}
                </div>
              </div>

              <div>
                <div className="label reviews-modal__label">Số sao</div>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <div>
                <div className="label reviews-modal__label">Nhận xét</div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn…"
                />
              </div>

              <div className="reviews-formField">
                <div className="label reviews-modal__label">Ảnh đính kèm (tối đa 6)</div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    addMediaFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {(existingMediaUrls?.length || newMedia?.length) ? (
                  <div className="reviews-media__grid">
                    {(existingMediaUrls || []).map((url, idx) => (
                      <div key={url + idx} className="reviews-media__item">
                        <a href={url} target="_blank" rel="noreferrer" className="reviews-media__link">
                          <img src={url} alt={`review-${idx + 1}`} className="reviews-media__img" />
                        </a>
                        <button type="button" className="reviews-media__remove" onClick={() => removeExistingMedia(idx)}>
                          ×
                        </button>
                      </div>
                    ))}
                    {(newMedia || []).map((m, idx) => (
                      <div key={m.previewUrl} className="reviews-media__item">
                        <img src={m.previewUrl} alt={`new-${idx + 1}`} className="reviews-media__img" />
                        <button type="button" className="reviews-media__remove" onClick={() => removeNewMedia(idx)}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="muted reviews-media__hint">Ảnh giúp người bán & người mua xem đánh giá rõ hơn.</div>
              </div>

              <div className="reviews-modal__actions">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    clearMediaState();
                    setModal(null);
                  }}
                  disabled={submitting}
                >
                  Đóng
                </button>
                <button className="btn btn-primary" onClick={submitCreate} disabled={submitting}>
                  {submitting ? "Đang gửi…" : "Gửi đánh giá"}
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {modal?.mode === "edit" ? (
          <Modal
            open
            title="Chỉnh sửa đánh giá (1 lần)"
            onClose={() =>
              submitting
                ? null
                : (() => {
                    clearMediaState();
                    setModal(null);
                  })()
            }
          >
            <div className="reviews-modal__grid">
              <div className="card reviews-modalProduct">
                <div className="reviews-modalProduct__name">{modal.payload?.product?.name || "Sản phẩm"}</div>
                <div className="muted reviews-modalProduct__meta">{formatDateTime(modal.payload?.createdAt)}</div>
              </div>

              <div>
                <div className="label reviews-modal__label">Số sao</div>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <div>
                <div className="label reviews-modal__label">Nhận xét</div>
                <textarea className="textarea" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
              </div>

              <div className="reviews-formField">
                <div className="label reviews-modal__label">Ảnh đính kèm (tối đa 6)</div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    addMediaFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {(existingMediaUrls?.length || newMedia?.length) ? (
                  <div className="reviews-media__grid">
                    {(existingMediaUrls || []).map((url, idx) => (
                      <div key={url + idx} className="reviews-media__item">
                        <a href={url} target="_blank" rel="noreferrer" className="reviews-media__link">
                          <img src={url} alt={`review-${idx + 1}`} className="reviews-media__img" />
                        </a>
                        <button type="button" className="reviews-media__remove" onClick={() => removeExistingMedia(idx)}>
                          ×
                        </button>
                      </div>
                    ))}
                    {(newMedia || []).map((m, idx) => (
                      <div key={m.previewUrl} className="reviews-media__item">
                        <img src={m.previewUrl} alt={`new-${idx + 1}`} className="reviews-media__img" />
                        <button type="button" className="reviews-media__remove" onClick={() => removeNewMedia(idx)}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="muted reviews-media__hint">Tổng số ảnh tối đa 6. Bạn có thể bỏ ảnh bằng nút ×.</div>
              </div>

              <div className="action-note action-note--warning">
                <b>Lưu ý:</b> Bạn chỉ được sửa 1 lần và trong vòng 7 ngày kể từ lúc tạo đánh giá. Hệ thống sẽ tự kiểm tra điều kiện khi lưu.
              </div>

              <div className="reviews-modal__actions">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    clearMediaState();
                    setModal(null);
                  }}
                  disabled={submitting}
                >
                  Đóng
                </button>
                <button className="btn btn-primary" onClick={submitEdit} disabled={submitting}>
                  {submitting ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {modal?.mode === "followup" ? (
          <Modal
            open
            title="Phản hồi thêm"
            onClose={() =>
              submitting
                ? null
                : (() => {
                    clearMediaState();
                    setModal(null);
                  })()
            }
          >
            <div className="reviews-modal__grid">
              <div className="card reviews-modalProduct">
                <div className="reviews-modalProduct__name">{modal.payload?.product?.name || "Sản phẩm"}</div>
                <div className="muted reviews-modalProduct__meta">Chỉ gửi được 1 lần sau khi shop phản hồi.</div>
              </div>

              <div>
                <div className="label reviews-modal__label">Nội dung</div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập phản hồi của bạn…"
                />
              </div>

              <div className="reviews-modal__actions">
                <button className="btn btn-outline" onClick={() => setModal(null)} disabled={submitting}>
                  Đóng
                </button>
                <button className="btn btn-primary" onClick={submitFollowUp} disabled={submitting}>
                  {submitting ? "Đang gửi…" : "Gửi phản hồi"}
                </button>
              </div>
            </div>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
