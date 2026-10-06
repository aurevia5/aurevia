"use client";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Nav from "@/components/Nav";
import { io } from "socket.io-client";
import PriceChart from "@/components/PriceChart";
import { useTradingStore } from "@/lib/store";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, RefreshCw } from "lucide-react";
type I = { id: string; symbol: string; price: number; change?: number; takerFee?: number; leverage?: number };
type Order = {
  id: string;
  status: string;
  side: string;
  type: string;
  quantity: number;
  filledQuantity: number;
  price?: number;
  stopPrice?: number;
  instrument: { symbol: string };
};
type Pos = {
  id: string;
  side: string;
  quantity: number;
  entryPrice: number;
  margin: number;
  instrument: { symbol: string; price: number };
};
export default function Trade() {
  const {data:session,status:sessionStatus}=useSession();
  const [items, setItems] = useState<I[]>([]);
  const updateStore = useTradingStore((s) => s.updatePrices);
  const [selected, setSelected] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"MARKET" | "LIMIT" | "STOP">("MARKET");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [book, setBook] = useState<any>({ bids: [], asks: [] });
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [accountMode, setAccountMode] = useState<'DEMO'|'REAL'|'LOADING'>('LOADING');
  const [placing, setPlacing] = useState(false);
  useEffect(() => {
    if(sessionStatus!=='authenticated')return;
    let active = true;
    setAccountMode('LOADING');
    setAvailableBalance(null);
    setOrders([]);
    setPositions([]);
    setMsg('');
    const load = async () => {
      try {
        const responses = await Promise.all([
          fetch("/api/market"),
          fetch("/api/orders"),
          fetch("/api/positions"),
          fetch("/api/wallet"),
        ]);
        if (responses.some((response) => !response.ok))
          throw new Error("Unable to load trading data.");
        const [market, orderData, positionData, walletData] = await Promise.all(
          responses.map((response) => response.json()),
        );
        if (!active) return;
        setItems(
          market.map((item: I) => ({ ...item, price: Number(item.price) })),
        );
        if (market[0]) setSelected(market[0].id);
        setOrders(orderData);
        setAccountMode(walletData.accountMode);
        setAvailableBalance(Number(walletData.balance));
        setPositions(
          positionData.map((position: any) => ({
            ...position,
            quantity: Number(position.quantity),
            entryPrice: Number(position.entryPrice),
            margin: Number(position.margin),
            instrument: {
              ...position.instrument,
              price: Number(position.instrument.price),
            },
          })),
        );
      } catch {
        if (active)
          setMsg("Unable to load trading data. Refresh to try again.");
      }
    };
    void load();
    const socket = io();
    const onMarketUpdate = (updates: I[]) => {
      setItems((old) =>
        old.map((item) => {
          const update = updates.find(
            (candidate) => candidate.symbol === item.symbol,
          );
          return update
            ? { ...item, price: update.price, change: update.change }
            : item;
        }),
      );
      updateStore(updates);
    };
    socket.on("market:update", onMarketUpdate);
    return () => {
      active = false;
      socket.off("market:update", onMarketUpdate);
      socket.disconnect();
    };
  }, [updateStore,sessionStatus,session?.user?.accountMode]);
  useEffect(() => {
    if (!selected) return;
    const load = () =>
      fetch(`/api/orderbook?instrumentId=${selected}`)
        .then((r) => r.json())
        .then(setBook);
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [selected]);
  const cur = items.find((i) => i.id === selected);
  const pnl = (p: Pos) =>
    p.side === "BUY"
      ? ((cur?.price ?? p.instrument.price) - p.entryPrice) * p.quantity
      : (p.entryPrice - (cur?.price ?? p.instrument.price)) * p.quantity;
  const requestedQuantity = Number(qty);
  const estimatedNotional = (cur?.price ?? 0) * (Number.isFinite(requestedQuantity) ? requestedQuantity : 0);
  const estimatedFee = estimatedNotional * Number(cur?.takerFee ?? 0);
  const estimatedMargin = estimatedNotional / Math.max(1, Number(cur?.leverage ?? 1));

  async function place(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(accountMode!=='DEMO'){setMsg('Real-account trading is unavailable because no external execution provider is connected.');return;}
    if (placing) return;
    setPlacing(true);
    setMsg("");
    try {
      const body = {
        instrumentId: selected,
        side,
        type,
        quantity: Number(qty),
        price: type === "LIMIT" && price ? Number(price) : undefined,
        stopPrice: type === "STOP" && price ? Number(price) : undefined,
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMsg(response.ok ? "Order accepted" : result.error || "Order failed");
      if (response.ok) {
        setOrders((current) => [result, ...current]);
        const positionResponse = await fetch("/api/positions");
        setPositions(await positionResponse.json());
      }
    } catch {
      setMsg("Unable to submit the order. Check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  }
  async function cancel(id: string) {
    const r = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    if (r.ok)
      setOrders((o) =>
        o.map((x) => (x.id === id ? { ...x, status: "CANCELLED" } : x)),
      );
  }
  async function close(id: string) {
    const r = await fetch("/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ positionId: id }),
    });
    const j = await r.json();
    setMsg(r.ok ? "Position closed" : j.error || "Close failed");
    if (r.ok) setPositions((p) => p.filter((x) => x.id !== id));
  }
  return (
    <>
      <Nav />
      <main className="trade-terminal">
        <header className="account-heading"><div><span className="account-kicker">{accountMode==='LOADING'?'Restoring account mode':`${accountMode} ACCOUNT · Trading workspace`}</span><h1>Trade markets</h1><p>Market data and executions in this workspace are simulated and never affect REAL account balances.</p></div><span className={`status-pill ${accountMode==='REAL'?'mode-real':'mode-demo'}`}>{accountMode==='REAL'?'REAL · execution unavailable':'DEMO prices'}</span></header>
        {accountMode==='REAL'&&<div className="account-callout mb-4"><span>Real-account trading is disabled because no external execution provider is connected. Switch to DEMO to use simulated orders; real ledger funds remain untouched.</span></div>}
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="card min-h-[650px] p-5">
            <div className="trade-market-select" role="group" aria-label="Select an instrument">
              {items.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => setSelected(i.id)}
                  className={`rounded-lg px-3 py-2 text-sm ${i.id === selected ? "bg-gold text-black" : "bg-white/5"}`}
                  aria-pressed={i.id === selected}
                >
                  {i.symbol}{" "}
                  {i.price.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
              <div className="trade-chart-panel">
                <div className="trade-chart-header"><div><span className="account-kicker">{cur?.symbol||"Select an instrument"}</span><p className="trade-last-price">{cur?.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:cur.price<10?4:2})||"—"}</p></div><span className="status-pill">Demo price</span></div>
                <div className="sr-only">Current simulated price chart</div>
                <div className="hidden">
                  <div className="mb-2 text-4xl font-black">
                  {cur?.price.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                  </div>
                </div>
                <PriceChart price={cur?.price ?? 0} />
                <p className="trade-chart-note">Internal simulated market · prices update from the application demo feed.</p>
              </div>
              <div className="trade-orderbook">
                <h3 className="font-bold">Order book <small>DEMO FEED ONLY</small></h3>
                <div className="mt-3 text-xs">
                  {book.asks
                    ?.slice()
                    .reverse()
                    .map((x: any) => (
                      <div
                        key={x.price}
                        className="flex justify-between text-loss"
                      >
                        <span>{x.price.toFixed(6)}</span>
                        <span>{x.quantity}</span>
                      </div>
                    ))}
                  <div className="my-2 border-t border-white/10" />
                  {book.bids?.map((x: any) => (
                    <div
                      key={x.price}
                      className="flex justify-between text-profit"
                    >
                      <span>{x.price.toFixed(6)}</span>
                      <span>{x.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="card p-5">
            <div className="account-panel-title"><div><h2>Order ticket</h2><p className="account-panel-subtitle">Review the order estimate before submitting.</p></div><span className={`status-pill ${accountMode==='REAL'?'mode-real':'mode-demo'}`}>{accountMode}</span></div>
            <form onSubmit={place} className="space-y-3">
              <fieldset disabled={accountMode!=='DEMO'} className="space-y-3">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Order side">
              <button type="button" aria-pressed={side === "BUY"}
                onClick={() => setSide("BUY")}
                className={`btn ${side === "BUY" ? "bg-profit text-black" : "bg-white/5"}`}
              >
                Buy
              </button>
              <button type="button" aria-pressed={side === "SELL"}
                onClick={() => setSide("SELL")}
                className={`btn ${side === "SELL" ? "bg-loss text-white" : "bg-white/5"}`}
              >
                Sell
              </button>
            </div>
              <label className="account-label">Order type<select className="input" required value={type} onChange={(event) => setType(event.target.value as "MARKET"|"LIMIT"|"STOP")}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="STOP">Stop</option></select></label>
              <label className="account-label">Quantity<input className="input" type="number" min="0.00000001" step="any" inputMode="decimal" required value={qty} onChange={(event) => setQty(event.target.value)} placeholder="0.00"/></label>
              {type !== "MARKET" && <label className="account-label">{type === "STOP" ? "Stop price" : "Limit price"}<input className="input" type="number" min="0.00000001" step="any" inputMode="decimal" required value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00"/></label>}
              <div className="trade-estimate" aria-live="polite"><div><span>Available balance</span><b>{availableBalance===null?"Loading…":`$${availableBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}</b></div><div><span>Estimated margin</span><b>{cur?`$${estimatedMargin.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</b></div><div><span>Estimated fee</span><b>{cur?.takerFee===undefined?"Not configured":`$${estimatedFee.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4})}`}</b></div></div>
              <p className="trade-estimate-note">Estimate uses the configured instrument price, leverage, and taker fee. Final validation happens on the server.</p>
              <button type="submit" disabled={placing||!selected||accountMode!=='DEMO'} className="btn w-full bg-gold text-black disabled:opacity-50">{placing?"Submitting…":accountMode==='REAL'?'REAL trading unavailable':`Place ${side} order`}</button>
              </fieldset>
              {msg&&<p className="text-sm muted" role="status">{msg}</p>}
            </form>
            <div className="mt-6">
              <h3 className="font-bold">Open orders</h3>
              {orders.filter((o) => o.status === "OPEN").length ? (
                orders
                  .filter((o) => o.status === "OPEN")
                  .map((o) => (
                    <div
                      key={o.id}
                      className="flex justify-between border-b border-white/10 py-2 text-xs"
                    >
                      <span>
                        {o.instrument.symbol} {o.side} {o.type}
                      </span>
                      <button type="button" onClick={() => cancel(o.id)} className="gold">
                        Cancel
                      </button>
                    </div>
                  ))
              ) : (
                <p className="mt-2 muted text-sm">No open orders.</p>
              )}
            </div>
          </section>
        </div>
        <section className="card mt-4 p-5">
          <div className="account-panel-title"><div><h2>Open positions</h2><p className="account-panel-subtitle">Unrealized P&amp;L uses the current simulated price.</p></div><span className="status-pill">{positions.length} open</span></div>
          {positions.length ? (
            <div className="mt-3 space-y-2">
              {positions.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3"
                >
                  <span>
                    {p.instrument.symbol} · {p.side} · {p.quantity}
                  </span>
                  <span className={pnl(p) >= 0 ? "text-profit" : "text-loss"}>
                    {pnl(p) >= 0 ? "+" : ""}${pnl(p).toFixed(2)}
                  </span>
                  <button type="button" className="btn bg-loss" onClick={() => close(p.id)}>
                    Close
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 muted">No open positions.</p>
          )}
        </section>
        <section className="account-panel card mt-4 p-5"><div className="account-panel-title"><div><h2>Order history</h2><p className="account-panel-subtitle">Recent submitted orders and recorded status.</p></div><RefreshCw size={17} className="gold" aria-hidden="true"/></div>
          {orders.length?<div className="account-table-wrap"><table className="account-table"><thead><tr><th>Instrument</th><th>Side</th><th>Type</th><th>Quantity</th><th>Limit / stop</th><th>Status</th></tr></thead><tbody>{orders.slice(0,20).map(order=><tr key={order.id}><td>{order.instrument.symbol}</td><td>{order.side}</td><td>{order.type}</td><td>{Number(order.quantity).toLocaleString()}</td><td>{order.type==='LIMIT'?Number(order.price||0).toLocaleString(undefined,{maximumFractionDigits:6}):order.type==='STOP'?Number(order.stopPrice||0).toLocaleString(undefined,{maximumFractionDigits:6}):'Market'}</td><td><span className="status-pill">{order.status.replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div>:<div className="account-empty">No submitted orders yet.</div>}
        </section>
      </main>
    </>
  );
}
