import '../styles/trading.css';
import type { MarketCategory, AssetAllocation } from '../types';
import { GameStore } from '../state/GameStore';
import { AudioEngine } from '../audio/AudioEngine';
import { SoundEffects } from '../audio/SoundEffects';
import { PixelTabs } from '../components/ui/PixelTabs';
import { NewsTicker } from '../components/ui/NewsTicker';
import { StocksPanel } from '../components/trading/StocksPanel';
import { FXPanel } from '../components/trading/FXPanel';
import { CryptoPanel } from '../components/trading/CryptoPanel';
import { PortfolioSummary } from '../components/trading/PortfolioSummary';
import { PixelButton } from '../components/ui/PixelButton';
import { PortfolioLineChart } from '../components/charts/PortfolioLineChart';
import { NewsOverlay } from '../components/ui/NewsOverlay';
import { EventPopup, type EventPopupChoicePayload } from '../components/ui/EventPopup';
import { CoachPopup } from '../components/ui/CoachPopup';
import { MarketEngine } from '../engine/MarketEngine';
import { GameLoop } from '../engine/GameLoop';
import type { CoachContext } from '../engine/coach-prompts';
import { useCoach } from '../lib/hooks/useCoach';
interface BaseScreen {
  mount(container: HTMLElement): void;
  unmount(): void;
}

const BEGINNING_VIDEO_URL = new URL('../animations/characters/1ch_beginning.mp4', import.meta.url).href;
const LOOP_VIDEO_URL = new URL('../animations/characters/1ch_loop.mp4', import.meta.url).href;

/** Avoid hundreds of rebalances per slider drag (each would compound bugs if weights were wrong). */
const REBALANCE_DEBOUNCE_MS = 220;

export class TradingScreen implements BaseScreen {
  private store: GameStore;
  private sfx: SoundEffects;
  private container: HTMLElement | null = null;
  private unsubscribes: Array<() => void> = [];
  private introVideo: HTMLVideoElement | null = null;
  private loopVideo: HTMLVideoElement | null = null;
  private terminalHost: HTMLElement | null = null;
  private tabs: PixelTabs | null = null;
  private stocksPanel: StocksPanel | null = null;
  private fxPanel: FXPanel | null = null;
  private cryptoPanel: CryptoPanel | null = null;
  private portfolioSummary: PortfolioSummary | null = null;
  private newsTicker: NewsTicker | null = null;
  private portfolioChart: PortfolioLineChart | null = null;
  private allocations: Map<string, { percentage: number; position: 'long' | 'short' }> = new Map();
  private panelContainer: HTMLElement | null = null;
  private activeTab: string = '';
  private terminalDragCleanup: (() => void) | null = null;
  private gameLoopUnsub: (() => void) | null = null;
  private simStatusEl: HTMLElement | null = null;
  private progressBarFill: HTMLElement | null = null;
  private newsOverlay: NewsOverlay | null = null;
  private lastNewsKey: string | null = null;
  private eventPopup: EventPopup | null = null;
  private eventPopupActive = false;
  private audio: AudioEngine;
  private rebalanceDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private coach = useCoach();
  private coachPopup: CoachPopup | null = null;
  private previousPhase: string = 'idle';
  private cashHeavyNotified = false;
  private milestoneNotified = false;
  private coachStartingPortfolio = 0;

  constructor(store: GameStore, audio: AudioEngine) {
    this.store = store;
    this.audio = audio;
    this.sfx = new SoundEffects(audio);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';

    const state = this.store.getState();

    const wrapper = document.createElement('div');
    wrapper.className = 'trading-screen scanlines';

    const splitLayout = document.createElement('div');
    splitLayout.className = 'trading-screen__layout';

    const leftHalf = document.createElement('div');
    leftHalf.className = 'trading-screen__room';
    this.buildVideoScene(leftHalf);
    splitLayout.appendChild(leftHalf);

    const rightHalf = document.createElement('div');
    rightHalf.className = 'trading-screen__terminal';
    // Terminal should appear after intro finishes
    rightHalf.classList.add('trading-screen__terminal--hidden');
    this.terminalHost = rightHalf;
    this.buildTerminal(rightHalf);
    splitLayout.appendChild(rightHalf);

    wrapper.appendChild(splitLayout);
    container.appendChild(wrapper);

    // Mount news overlay inside trading screen
    this.newsOverlay = new NewsOverlay();
    this.newsOverlay.mount(wrapper);
    this.coachStartingPortfolio = state.startingPortfolio || state.portfolioValue || 10000;
    this.cashHeavyNotified = false;
    this.milestoneNotified = false;
    this.previousPhase = 'idle';
    this.coachPopup = new CoachPopup(this.coach);
    this.coachPopup.mount(document.body);

    // Show legacy round event popup if pending (from TimeskipScreen)
    if (state.pendingLegacyEvent) {
      this.store.dispatch({ type: 'SET_PENDING_LEGACY_EVENT', pending: false });
      setTimeout(() => this.showEventPopup(), 400);
    }
  }

  private buildVideoScene(parent: HTMLElement): void {
    const state = this.store.getState();

    parent.style.position = 'relative';

    const stage = document.createElement('div');
    stage.className = 'trading-screen__video-stage';

    const intro = document.createElement('video');
    intro.className = 'trading-screen__bg-video trading-screen__bg-video--intro';
    intro.src = BEGINNING_VIDEO_URL;
    intro.autoplay = true;
    intro.muted = true; // autoplay reliably
    intro.playsInline = true;
    intro.loop = false;
    intro.preload = 'auto';

    const loop = document.createElement('video');
    loop.className = 'trading-screen__bg-video trading-screen__bg-video--loop';
    loop.src = LOOP_VIDEO_URL;
    loop.autoplay = false;
    loop.muted = true;
    loop.playsInline = true;
    loop.loop = true;
    loop.preload = 'auto';
    loop.style.display = 'none';

    const finishIntro = (): void => {
      // Swap to loop video
      intro.style.display = 'none';
      loop.style.display = 'block';
      void loop.play().catch(() => {
        // ignore
      });
      this.revealTerminal();
    };

    intro.addEventListener('ended', finishIntro);

    // Start playback ASAP (ignore failures if browser blocks it)
    void intro.play().catch(() => {
      // ignore
    });

    this.introVideo = intro;
    this.loopVideo = loop;

    stage.appendChild(intro);
    stage.appendChild(loop);
    parent.appendChild(stage);

    const phaseLabel = document.createElement('div');
    phaseLabel.className = 'trading-screen__phase';
    const roundNames = ['YEAR 1 — GROWTH', 'YEAR 1.5 — CRASH', 'YEAR 2-4 — RECOVERY'];
    phaseLabel.textContent = roundNames[state.currentRound] ?? 'YEAR 1 — GROWTH';
    parent.appendChild(phaseLabel);

    const seasonLabel = document.createElement('div');
    seasonLabel.className = 'trading-screen__season';
    seasonLabel.textContent = state.season.toUpperCase();
    parent.appendChild(seasonLabel);

    // Optional: allow clicking video area to skip intro video
    const skipHint = document.createElement('button');
    skipHint.className = 'trading-screen__skip-intro';
    skipHint.textContent = 'SKIP INTRO';
    skipHint.addEventListener('click', () => {
      this.sfx.buttonPress();
      finishIntro();
      (skipHint as HTMLButtonElement).style.display = 'none';
    });
    parent.appendChild(skipHint);
  }

  private revealTerminal(): void {
    if (!this.terminalHost) return;
    if (!this.terminalHost.classList.contains('trading-screen__terminal--hidden')) return;
    this.terminalHost.classList.remove('trading-screen__terminal--hidden');
    this.terminalHost.classList.add('trading-screen__terminal--enter');
    window.setTimeout(() => {
      this.terminalHost?.classList.remove('trading-screen__terminal--enter');
    }, 800);
  }

  private buildTerminal(parent: HTMLElement): void {
    const state = this.store.getState();
    const categories = state.selectedCategories;

    const monitor = document.createElement('div');
    monitor.className = 'terminal-monitor';

    const terminalBezel = document.createElement('div');
    terminalBezel.className = 'terminal-bezel';

    const terminalScreen = document.createElement('div');
    terminalScreen.className = 'terminal-screen';

    // Terminal header bar
    const terminalHeader = document.createElement('div');
    terminalHeader.className = 'terminal-header';
    const headerTitle = document.createElement('span');
    headerTitle.className = 'terminal-header__title';
    headerTitle.textContent = '▶ TRADING TERMINAL';
    const headerRound = document.createElement('span');
    headerRound.style.fontFamily = "'VT323', monospace";
    headerRound.style.fontSize = '18px';
    headerRound.style.color = 'var(--muted-gray-light)';
    const roundNames = ['ROUND 1 — GROWTH', 'ROUND 2 — CRASH', 'ROUND 3 — RECOVERY'];
    headerRound.textContent = roundNames[state.currentRound] ?? 'ROUND 1';
    terminalHeader.appendChild(headerTitle);
    terminalHeader.appendChild(headerRound);
    terminalScreen.appendChild(terminalHeader);

    // Make terminal draggable by header
    this.terminalDragCleanup?.();
    this.terminalDragCleanup = this.makeDraggableTerminal(parent, terminalHeader);

    const tabDefs: Array<{ id: string; label: string }> = [];
    if (categories.includes('stocks')) tabDefs.push({ id: 'stocks', label: 'STOCKS' });
    if (categories.includes('fx')) tabDefs.push({ id: 'fx', label: 'FOREX' });
    if (categories.includes('crypto')) tabDefs.push({ id: 'crypto', label: 'CRYPTO' });
    tabDefs.push({ id: 'portfolio', label: 'PORTFOLIO' });

    this.activeTab = tabDefs[0]?.id ?? 'stocks';

    const tabContainer = document.createElement('div');
    this.tabs = new PixelTabs(tabContainer, tabDefs, (id) => {
      this.sfx.tabClick();
      this.activeTab = id;
      this.showPanel(id);
    });
    this.tabs.render();
    terminalScreen.appendChild(tabContainer);

    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'terminal-panel-area';
    this.panelContainer.style.flex = '1';
    this.panelContainer.style.overflow = 'auto';
    terminalScreen.appendChild(this.panelContainer);

    this.buildPanels();
    this.showPanel(this.activeTab);

    const summaryContainer = document.createElement('div');
    this.portfolioSummary = new PortfolioSummary(summaryContainer);
    this.portfolioSummary.render();
    this.updatePortfolioSummary();
    terminalScreen.appendChild(summaryContainer);

    const tickerContainer = document.createElement('div');
    this.newsTicker = new NewsTicker(tickerContainer);
    this.newsTicker.render();
    terminalScreen.appendChild(tickerContainer);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'trading-screen__invest-btn';
    buttonContainer.style.cssText = 'display: flex; gap: 8px; align-items: center; flex-wrap: wrap;';

    // Simulation status display
    this.simStatusEl = document.createElement('div');
    this.simStatusEl.style.cssText = `
      font-family: 'Press Start 2P', monospace; font-size: 10px; color: #8899aa;
      flex: 1; min-width: 200px;
    `;
    this.simStatusEl.textContent = 'Ready to simulate';
    buttonContainer.appendChild(this.simStatusEl);

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 100%; height: 6px; background: #1e3a5f; border-radius: 3px;
      margin-top: 4px; overflow: hidden;
    `;
    this.progressBarFill = document.createElement('div');
    this.progressBarFill.style.cssText = `
      width: 0%; height: 100%; background: linear-gradient(90deg, #40c4ff, #00e676);
      transition: width 0.3s ease;
    `;
    progressBar.appendChild(this.progressBarFill);
    buttonContainer.appendChild(progressBar);

    // Play button
    const playBtn = new PixelButton('▶ PLAY', () => {
      this.sfx.buttonPress();
      const engines = (window as unknown as Record<string, unknown>).__gameEngines as
        { gameLoop: GameLoop } | undefined;
      if (engines?.gameLoop) {
        const phase = engines.gameLoop.getPhase();
        if (phase === 'paused' || phase === 'idle') {
          engines.gameLoop.play();
        } else if (phase === 'simulating') {
          engines.gameLoop.pause();
        }
      }
    }, 'blue', false);
    buttonContainer.appendChild(playBtn.getElement());

    // Speed buttons
    for (const speed of [1, 3, 5] as const) {
      const label = speed === 1 ? '1×' : speed === 3 ? '3×' : '5×';
      const speedBtn = new PixelButton(label, () => {
        this.sfx.tabClick();
        const engines = (window as unknown as Record<string, unknown>).__gameEngines as
          { gameLoop: GameLoop } | undefined;
        if (engines?.gameLoop) {
          engines.gameLoop.setSpeed(speed);
        }
      }, 'default', false);
      buttonContainer.appendChild(speedBtn.getElement());
    }

    // Skip Year button
    const skipYearBtn = new PixelButton('⏩ SKIP YEAR', () => {
      this.sfx.timeskipWhoosh();
      const engines = (window as unknown as Record<string, unknown>).__gameEngines as
        { gameLoop: GameLoop } | undefined;
      if (engines?.gameLoop) {
        engines.gameLoop.skipYear();
      }
    }, 'gold', false);
    buttonContainer.appendChild(skipYearBtn.getElement());

    // Legacy invest button (fallback for offline mode)
    const investBtn = new PixelButton('SKIP →', () => {
      this.sfx.timeskipWhoosh();

      const currentAllocations = this.getCurrentAllocations();
      this.store.dispatch({ type: 'SET_ALLOCATION', allocations: currentAllocations });

      const engines = (window as unknown as Record<string, unknown>).__gameEngines as
        { marketEngine: MarketEngine } | undefined;
      if (engines) {
        const currentRound = this.store.getState().currentRound;
        const monthRanges = [12, 18, 42];
        const targetMonth = monthRanges[currentRound] ?? 42;
        const portfolioValue = engines.marketEngine.calculatePortfolioValue(targetMonth);
        this.store.setState({
          portfolioValue,
          currentMonth: targetMonth,
        });
      }

      this.store.dispatch({ type: 'CONFIRM_TIMESKIP' });
      this.store.dispatch({ type: 'SET_SCREEN', screen: 'timeskip' });
    }, 'gold', true);
    buttonContainer.appendChild(investBtn.getElement());

    terminalScreen.appendChild(buttonContainer);

    // Subscribe to GameLoop updates
    const glEngines = (window as unknown as Record<string, unknown>).__gameEngines as
      { gameLoop: GameLoop } | undefined;
    if (glEngines?.gameLoop) {
      this.gameLoopUnsub = glEngines.gameLoop.subscribe(() => {
        this.onGameLoopTick(glEngines.gameLoop);
      });
    }

    terminalBezel.appendChild(terminalScreen);

    monitor.appendChild(terminalBezel);
    parent.appendChild(monitor);
  }

  private makeDraggableTerminal(terminalHost: HTMLElement, handle: HTMLElement): () => void {
    // terminalHost is `.trading-screen__terminal` which is positioned absolutely.
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let pointerId: number | null = null;

    const getPx = (v: string | null): number => {
      if (!v) return 0;
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };

    const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

    const onPointerDown = (e: PointerEvent): void => {
      // Only left click / primary pointer
      if (e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      handle.setPointerCapture(pointerId);

      const cs = window.getComputedStyle(terminalHost);
      startLeft = getPx(cs.left);
      startTop = getPx(cs.top);
      startX = e.clientX;
      startY = e.clientY;

      // Ensure explicit left/top so we can move from the current position
      terminalHost.style.left = `${startLeft}px`;
      terminalHost.style.top = `${startTop}px`;
      terminalHost.style.right = 'auto';

      terminalHost.classList.add('terminal--dragging');
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const rect = terminalHost.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width - 8;
      const maxTop = window.innerHeight - rect.height - 8;

      const nextLeft = clamp(startLeft + dx, 8, Math.max(8, maxLeft));
      const nextTop = clamp(startTop + dy, 8, Math.max(8, maxTop));

      terminalHost.style.left = `${nextLeft}px`;
      terminalHost.style.top = `${nextTop}px`;
    };

    const endDrag = (): void => {
      if (!dragging) return;
      dragging = false;
      terminalHost.classList.remove('terminal--dragging');
      if (pointerId != null) {
        try {
          handle.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
      pointerId = null;
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (pointerId != null && e.pointerId !== pointerId) return;
      endDrag();
    };

    const onPointerCancel = (e: PointerEvent): void => {
      if (pointerId != null && e.pointerId !== pointerId) return;
      endDrag();
    };

    handle.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      endDrag();
    };
  }

  /** Debounced: slider `input` fires many times per drag; one rebalance after pause. */
  private scheduleSimulationRebalance(newAllocs: Array<{ assetId: string; pct: number }>): void {
    if (this.rebalanceDebounceTimer) {
      clearTimeout(this.rebalanceDebounceTimer);
    }
    this.rebalanceDebounceTimer = setTimeout(() => {
      this.rebalanceDebounceTimer = null;
      const glEngines = (window as unknown as Record<string, unknown>).__gameEngines as
        { gameLoop: GameLoop } | undefined;
      const gameLoop = glEngines?.gameLoop;
      if (!gameLoop) return;
      gameLoop.rebalance(newAllocs);
      this.maybeTriggerRebalanceCoach(gameLoop, newAllocs);
    }, REBALANCE_DEBOUNCE_MS);
  }

  private buildCoachContext(gameLoop: GameLoop): Omit<CoachContext, 'trigger'> | null {
    const simState = gameLoop.getState();
    if (!simState) return null;
    return {
      totalPortfolio: simState.totalPortfolio,
      startingPortfolio: this.coachStartingPortfolio,
      positions: simState.positions.map((p) => ({
        assetId: p.assetId,
        name: p.assetId.toUpperCase(),
        pct: p.pct,
        value: p.value,
      })),
      cashPct: simState.positions.find((p) => p.assetId === 'cash')?.pct ?? 0,
      currentDrawdownPct: simState.currentDrawdownPct,
      peakPortfolio: simState.peakPortfolio,
      currentYear: gameLoop.getCurrentYear(),
      totalYears: Math.max(1, Math.floor(simState.totalTicks / 52)),
      totalRebalances: simState.totalRebalances,
      panicRebalances: simState.panicRebalances,
      cashHeavyWeeks: simState.cashHeavyWeeks,
    };
  }

  private maybeTriggerRebalanceCoach(
    gameLoop: GameLoop,
    newAllocs: Array<{ assetId: string; pct: number }>,
  ): void {
    const baseCtx = this.buildCoachContext(gameLoop);
    if (!baseCtx) return;

    const cashPct = newAllocs.find((a) => a.assetId === 'cash')?.pct ?? 0;
    const bondPct = newAllocs.find((a) => a.assetId === 'ch_bond')?.pct ?? 0;
    const goldPct = newAllocs.find((a) => a.assetId === 'gold_chf')?.pct ?? 0;
    const equityPct = Math.max(0, 100 - cashPct - bondPct - goldPct);

    if (baseCtx.currentDrawdownPct > 10 && cashPct + bondPct > 50) {
      this.coach.triggerCoach({
        ...baseCtx,
        trigger: 'panic_rebalance',
        cashPct,
      });
      return;
    }

    if (equityPct >= 90) {
      this.coach.triggerCoach({
        ...baseCtx,
        trigger: 'all_in_equity',
        positions: newAllocs.map((allocation) => ({
          assetId: allocation.assetId,
          name: allocation.assetId.toUpperCase(),
          pct: allocation.pct,
          value: (baseCtx.totalPortfolio * allocation.pct) / 100,
        })),
      });
    }
  }

  private triggerLifeEventAfterChoice(gameLoop: GameLoop, payload: EventPopupChoicePayload): void {
    const baseCtx = this.buildCoachContext(gameLoop);
    if (!baseCtx) return;
    this.coach.triggerCoach({
      ...baseCtx,
      trigger: 'life_event_after',
      chosenOption: payload.chosen,
      chosenLabel: payload.chosenLabel,
      eventTitle: payload.eventTitle,
      optionALabel: payload.optionALabel,
      optionBLabel: payload.optionBLabel,
      portfolioBefore: payload.portfolioBefore,
      portfolioAfter: payload.portfolioAfter,
      socialProofPct: payload.socialProofPct,
    });
  }

  private buildPanels(): void {
    const state = this.store.getState();
    const handleAllocationChange = (assetId: string, pct: number, position: 'long' | 'short'): void => {
      this.allocations.set(assetId, { percentage: pct, position });
      this.updatePortfolioSummary();

      // Keep the GameLoop simulation in sync with the user's allocation choices
      const glEngines = (window as unknown as Record<string, unknown>).__gameEngines as
        { gameLoop: GameLoop } | undefined;
      if (glEngines?.gameLoop) {
        const totalAllocPct = Array.from(this.allocations.values()).reduce((s, a) => s + a.percentage, 0);
        const cashPct = Math.max(0, 100 - totalAllocPct);
        const newAllocs: Array<{ assetId: string; pct: number }> = [];
        for (const [id, alloc] of this.allocations) {
          if (alloc.percentage > 0) newAllocs.push({ assetId: id, pct: alloc.percentage });
        }
        if (cashPct > 0) newAllocs.push({ assetId: 'cash', pct: cashPct });
        this.scheduleSimulationRebalance(newAllocs);
      }
    };

    if (state.selectedCategories.includes('stocks')) {
      const stocksContainer = document.createElement('div');
      stocksContainer.dataset.panel = 'stocks';
      stocksContainer.style.display = 'none';
      this.stocksPanel = new StocksPanel(stocksContainer, handleAllocationChange);
      this.stocksPanel.render();
      this.updatePanelPrices('stocks');
      this.panelContainer?.appendChild(stocksContainer);
    }

    if (state.selectedCategories.includes('fx')) {
      const fxContainer = document.createElement('div');
      fxContainer.dataset.panel = 'fx';
      fxContainer.style.display = 'none';
      this.fxPanel = new FXPanel(fxContainer, handleAllocationChange);
      this.fxPanel.render();
      this.updatePanelPrices('fx');
      this.panelContainer?.appendChild(fxContainer);
    }

    if (state.selectedCategories.includes('crypto')) {
      const cryptoContainer = document.createElement('div');
      cryptoContainer.dataset.panel = 'crypto';
      cryptoContainer.style.display = 'none';
      this.cryptoPanel = new CryptoPanel(cryptoContainer, handleAllocationChange);
      this.cryptoPanel.render();
      this.updatePanelPrices('crypto');
      this.panelContainer?.appendChild(cryptoContainer);
    }

    const portfolioContainer = document.createElement('div');
    portfolioContainer.dataset.panel = 'portfolio';
    portfolioContainer.style.display = 'none';
    this.portfolioChart = new PortfolioLineChart(portfolioContainer);
    this.portfolioChart.render();
    this.updatePortfolioChart();
    this.panelContainer?.appendChild(portfolioContainer);
  }

  private showPanel(id: string): void {
    if (!this.panelContainer) return;
    const panels = this.panelContainer.querySelectorAll('[data-panel]');
    panels.forEach((p) => {
      (p as HTMLElement).style.display = 'none';
    });
    const target = this.panelContainer.querySelector(`[data-panel="${id}"]`) as HTMLElement | null;
    if (target) {
      target.style.display = 'block';
    }
  }

  private updatePanelPrices(category: MarketCategory): void {
    const state = this.store.getState();
    const month = state.currentMonth;
    const pricePaths = state.pricePaths;
    const prices: Record<string, { price: number; change: number }> = {};

    for (const [assetId, path] of Object.entries(pricePaths)) {
      if (month < path.length) {
        prices[assetId] = { price: path[month].price, change: path[month].change };
      }
    }

    if (category === 'stocks' && this.stocksPanel) {
      this.stocksPanel.updatePrices(prices);
    }
    if (category === 'fx' && this.fxPanel) {
      this.fxPanel.updatePrices(prices);
    }
    if (category === 'crypto' && this.cryptoPanel) {
      this.cryptoPanel.updatePrices(prices);
    }
  }

  private updatePortfolioSummary(): void {
    if (!this.portfolioSummary) return;
    const state = this.store.getState();

    // Prefer live GameLoop simulation state when available
    const glEngines = (window as unknown as Record<string, unknown>).__gameEngines as
      { gameLoop: GameLoop } | undefined;
    const simState = glEngines?.gameLoop?.getState();

    const portfolioValue = simState?.totalPortfolio ?? state.portfolioValue;
    const cashValue = simState?.cashValue ?? state.currentCash;
    const startingCash = state.startingCash;

    // Build allocation breakdown from live sim positions when available,
    // otherwise fall back to the local UI allocation map
    const categoryPcts: Record<string, number> = {};

    if (simState && simState.positions.length > 0) {
      const total = simState.totalPortfolio;
      for (const pos of simState.positions) {
        if (pos.value <= 0) continue;
        let cat = 'stocks';
        if (pos.assetId === 'cash') cat = 'cash';
        else if (pos.assetId.includes('chf') || pos.assetId.includes('bond') || pos.assetId.includes('gold')) cat = 'fx';
        else if (['btc', 'eth', 'sol', 'mooninu'].includes(pos.assetId)) cat = 'crypto';
        const pct = total > 0 ? (pos.value / total) * 100 : 0;
        categoryPcts[cat] = (categoryPcts[cat] ?? 0) + pct;
      }
    } else {
      let totalAllocPct = 0;
      for (const [, alloc] of this.allocations) {
        totalAllocPct += alloc.percentage;
      }
      for (const [assetId, alloc] of this.allocations) {
        let cat = 'stocks';
        if (assetId.includes('chf')) cat = 'fx';
        if (['btc', 'eth', 'sol', 'mooninu'].includes(assetId)) cat = 'crypto';
        categoryPcts[cat] = (categoryPcts[cat] ?? 0) + alloc.percentage;
      }
      const cashPct = Math.max(0, 100 - totalAllocPct);
      if (cashPct > 0) {
        categoryPcts['cash'] = (categoryPcts['cash'] ?? 0) + cashPct;
      }
    }

    const allocArray = Object.entries(categoryPcts).map(([category, pct]) => ({ category, pct }));
    const returnPct = startingCash > 0
      ? ((portfolioValue - startingCash) / startingCash) * 100
      : 0;

    this.portfolioSummary.update(portfolioValue, returnPct, cashValue, allocArray);
  }

  private updatePortfolioChart(): void {
    if (!this.portfolioChart) return;
    const state = this.store.getState();

    const portfolioData: number[] = [];
    const benchmarkData: number[] = [];
    const labels: string[] = [];

    for (let m = 0; m <= state.currentMonth && m < state.benchmarkPath.length; m++) {
      labels.push(`M${m}`);
      benchmarkData.push(state.benchmarkPath[m].price);

      const engines = (window as unknown as Record<string, unknown>).__gameEngines as
        { marketEngine: MarketEngine } | undefined;
      if (engines) {
        portfolioData.push(engines.marketEngine.calculatePortfolioValue(m));
      } else {
        portfolioData.push(state.startingCash);
      }
    }

    if (labels.length === 0) {
      labels.push('M0');
      portfolioData.push(state.startingCash);
      benchmarkData.push(state.startingCash);
    }

    this.portfolioChart.update(portfolioData, benchmarkData, labels);
  }

  private getCurrentAllocations(): AssetAllocation[] {
    const result: AssetAllocation[] = [];
    for (const [assetId, data] of this.allocations) {
      if (data.percentage > 0) {
        result.push({ assetId, percentage: data.percentage, position: data.position });
      }
    }
    return result;
  }

  private onGameLoopTick(gameLoop: GameLoop): void {
    const phase = gameLoop.getPhase();
    const simState = gameLoop.getState();
    const baseCtx = this.buildCoachContext(gameLoop);

    // Update status
    if (this.simStatusEl) {
      const year = gameLoop.getCurrentYear();
      const week = gameLoop.getCurrentWeekInYear();
      const speed = gameLoop.getSpeed();
      const portfolio = simState?.totalPortfolio ?? 0;
      this.simStatusEl.textContent = `Year ${year} • Week ${week} • ${speed}× • CHF ${Math.round(portfolio).toLocaleString()}`;
    }

    // Update progress bar
    if (this.progressBarFill) {
      this.progressBarFill.style.width = `${gameLoop.getProgressPct()}%`;
    }

    // Update portfolio chart with sim data
    this.updatePortfolioChart();
    this.updatePortfolioSummary();

    // Show historical news when the GameLoop fires one
    if (gameLoop.historicalNews && gameLoop.historicalNews.name !== this.lastNewsKey) {
      this.lastNewsKey = gameLoop.historicalNews.name;
      this.newsOverlay?.show(gameLoop.historicalNews.name, 5500);
      if (phase === 'simulating' && baseCtx) {
        if (
          gameLoop.historicalNews.type === 'crash' ||
          gameLoop.historicalNews.type === 'shock' ||
          gameLoop.historicalNews.type === 'warning'
        ) {
          this.coach.triggerCoach({
            ...baseCtx,
            trigger: 'market_crash',
            historicalEventName: gameLoop.historicalNews.name,
          });
        } else if (
          gameLoop.historicalNews.type === 'recovery' ||
          gameLoop.historicalNews.type === 'milestone'
        ) {
          this.coach.triggerCoach({
            ...baseCtx,
            trigger: 'market_recovery',
            historicalEventName: gameLoop.historicalNews.name,
          });
        }
      }
    }

    if (
      this.previousPhase === 'idle' &&
      (phase === 'paused' || phase === 'simulating') &&
      baseCtx
    ) {
      this.coach.triggerCoach({
        ...baseCtx,
        trigger: 'game_start',
      });
    }

    if (phase === 'event' && this.previousPhase !== 'event' && gameLoop.activeEvent && baseCtx) {
      this.coach.triggerCoach({
        ...baseCtx,
        trigger: 'life_event_before',
        eventTitle: gameLoop.activeEvent.title,
        eventDescription: gameLoop.activeEvent.description,
        optionALabel: gameLoop.activeEvent.optionA.label,
        optionBLabel: gameLoop.activeEvent.optionB.label,
      });
    }

    if (!this.cashHeavyNotified && phase === 'simulating' && simState && simState.cashHeavyWeeks > 30 && baseCtx) {
      this.cashHeavyNotified = true;
      this.coach.triggerCoach({
        ...baseCtx,
        trigger: 'cash_heavy',
      });
    }

    if (
      !this.milestoneNotified &&
      phase === 'simulating' &&
      simState &&
      this.coachStartingPortfolio > 0 &&
      simState.totalPortfolio > this.coachStartingPortfolio * 3 &&
      baseCtx
    ) {
      this.milestoneNotified = true;
      this.coach.triggerCoach({
        ...baseCtx,
        trigger: 'milestone',
      });
    }

    // Handle phase transitions
    if (phase === 'event' && gameLoop.activeEvent && !this.eventPopupActive) {
      this.showEventPopup();
    } else if (phase === 'results') {
      this.store.dispatch({ type: 'FINISH_GAME' });
    }
    this.previousPhase = phase;
  }

  private showEventPopup(): void {
    if (!this.container || this.eventPopupActive) return;
    this.eventPopupActive = true;
    this.eventPopup = new EventPopup(this.store, this.audio, {
      onEventChoice: (payload) => {
        const engines = (window as unknown as Record<string, unknown>).__gameEngines as
          { gameLoop: GameLoop } | undefined;
        const gameLoop = engines?.gameLoop;
        if (!gameLoop) return;
        this.triggerLifeEventAfterChoice(gameLoop, payload);
      },
    });
    this.eventPopup.show(this.container, () => {
      this.eventPopupActive = false;
      this.eventPopup = null;
    });
  }

  unmount(): void {
    if (this.rebalanceDebounceTimer) {
      clearTimeout(this.rebalanceDebounceTimer);
      this.rebalanceDebounceTimer = null;
    }
    this.eventPopup?.destroy();
    this.eventPopup = null;
    this.eventPopupActive = false;
    this.coachPopup?.destroy();
    this.coachPopup = null;
    this.coach.destroy();
    this.terminalDragCleanup?.();
    this.terminalDragCleanup = null;
    this.gameLoopUnsub?.();
    this.gameLoopUnsub = null;
    this.terminalHost = null;
    this.newsOverlay?.destroy();
    this.newsOverlay = null;
    this.lastNewsKey = null;
    if (this.introVideo) {
      this.introVideo.pause();
      this.introVideo.removeAttribute('src');
      this.introVideo.load();
      this.introVideo = null;
    }
    if (this.loopVideo) {
      this.loopVideo.pause();
      this.loopVideo.removeAttribute('src');
      this.loopVideo.load();
      this.loopVideo = null;
    }
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.stocksPanel?.destroy();
    this.fxPanel?.destroy();
    this.cryptoPanel?.destroy();
    this.portfolioSummary?.destroy();
    this.newsTicker?.destroy();
    this.tabs?.destroy();
    this.portfolioChart?.destroy();
    this.allocations.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
