/** Просроченные возвраты — задачи дня. Переехало из прежнего «Обзора» без изменений. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listOverdue, type Booking } from "../../api/domain";
import { MONO, css, dm } from "../../design/css";
import { I_CHECK, I_CLOCK, Svg } from "../../design/icons";
import { HButton, OverdueBadge } from "../../design/ui";
import { daysOverdue, onHandsLabel } from "../../domain/booking";
import { PANEL } from "../../design/table";


export default function Overdue() {
  const nav = useNavigate();
  const [overdue, setOverdue] = useState<Booking[]>([]);

  useEffect(() => {
    listOverdue()
      .then(setOverdue)
      .catch(() => setOverdue([]));
  }, []);

  return (
    <section
      style={css(PANEL)}
    >
      <div
        style={css(
          "display:flex;align-items:center;gap:8px;padding:13px 16px;border-bottom:1px solid var(--border-2)"
        )}
      >
        <span style={css("display:flex;color:var(--danger)")}>
          <Svg paths={I_CLOCK} size={16} sw={1.6} />
        </span>
        <h3 style={css("margin:0;font-size:13.5px;font-weight:600")}>Просроченные возвраты</h3>
        {overdue.length > 0 && (
          <span
            style={css(
              "margin-left:auto;background:var(--danger-tint);color:var(--danger);font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;" + MONO
            )}
          >
            {overdue.length}
          </span>
        )}
      </div>

      {overdue.length > 0 ? (
        <div>
          {overdue.map((b) => {
            const over = daysOverdue(b);
            return (
              <HButton
                key={b.id}
                onClick={() => nav(`/bookings/${b.id}`)}
                s="width:100%;text-align:left;border:none;background:transparent;border-bottom:1px solid var(--hover);padding:12px 16px;cursor:pointer;display:flex;gap:12px;align-items:center"
                hover="background:var(--surface-2)"
              >
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("display:flex;align-items:center;gap:8px")}>
                    <span
                      style={css(
                        MONO + ";font-size:12px;color:var(--text-3)"
                      )}
                    >
                      №{b.id}
                    </span>
                    <span style={css("font-weight:600;font-size:13px")}>{b.client_name}</span>
                  </div>
                  <div style={css("font-size:11.5px;color:var(--text-3);margin-top:3px")}>
                    {onHandsLabel(b)}
                  </div>
                </div>
                <div style={css("text-align:right;flex:none")}>
                  <div style={css("font-size:11px;color:var(--text-3)")}>
                    возврат {dm(b.expected_return_date)}
                  </div>
                  <div style={css("margin-top:3px")}>
                    <OverdueBadge text={over === 1 ? "1 день" : `${over} дн.`} />
                  </div>
                </div>
              </HButton>
            );
          })}
        </div>
      ) : (
        <div style={css("padding:34px 16px;text-align:center;color:var(--text-3)")}>
          <div
            style={css(
              "width:40px;height:40px;border-radius:50%;background:var(--green-tint);color:var(--green);display:flex;align-items:center;justify-content:center;margin:0 auto 10px"
            )}
          >
            <Svg paths={I_CHECK} size={20} sw={2} />
          </div>
          <div style={css("font-size:13px;font-weight:500;color:var(--text-2)")}>Просрочек нет</div>
          <div style={css("font-size:11.5px;margin-top:2px")}>Все возвраты в срок</div>
        </div>
      )}
    </section>
  );
}
