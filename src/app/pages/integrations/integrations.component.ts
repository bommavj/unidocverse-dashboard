// src/app/pages/integrations/integrations.component.ts
import {
  Component, OnInit, OnDestroy, ViewChild,
  ElementRef, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface CloudProvider {
  provider: string;
  label: string;
  models: string[];
  default_model: string;
  needs_url: boolean;
  base_url: string | null;
  configured: boolean;
  key_hint: string | null;
  model: string;
  active: boolean;
}

interface Integration {
  provider: string;
  label: string;
  enabled: boolean;
  connected: boolean;
  chat_id?: string;
  has_token?: boolean;
  has_webhook?: boolean;
  phone_number?: string;
  from_number?: string;
}

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './integrations.component.html',
  styleUrls: ['./integrations.component.scss'],
})

export class IntegrationsComponent implements OnInit, OnDestroy {

  @ViewChild('modalVideo') modalVideoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('modalCanvas') modalCanvasEl?: ElementRef<HTMLCanvasElement>;

  // AI Models
  models:        string[] = [];
  currentModel   = '';
  switchingModel = false;
  loadingModels  = true;

  // Cloud models (frontier providers with the organisation's own API key)
  providers:       CloudProvider[] = [];
  activeProvider:  string | null = null;
  editing:         CloudProvider | null = null;
  editKey          = '';
  editModel        = '';
  editUrl          = '';
  providerBusy     = false;
  testResult:      { ok: boolean; text: string } | null = null;
  modelOptions:    string[] = [];        // from the provider's own model list for this key
  modelsLoading    = false;
  modelsNote       = '';
  customModel      = false;              // "Other…" chosen: type any model id
  readonly OTHER   = '__other__';

  // Data protection + usage for cloud models
  policy: {
    ask_before_send: boolean; mask_identifiers: boolean; blocked_types: string[];
    upload_cloud: boolean; upload_types: string[]; upload_model: string | null; monthly_budget_usd: number | null;
    cascade_local_first: boolean;
  } | null = null;
  monthSpend = 0;
  showTypes = false;
  knownTypes: string[] = [];
  policySaving = false;
  usage: any = null;

  // QuickBooks Online
  qb: any = null;
  qbForm = { client_id: '', client_secret: '', environment: 'sandbox' };
  qbAccounts: { id: string; name: string }[] = [];
  qbBills: any[] = [];
  qbDraft: any = null;          // { push_id, draft, checks, edit }
  qbBusy = false;

  // Outbound systems: tiles + drawer
  readonly sysKeys = ['quickbooks', 'salesforce', 'webhooks'];
  readonly sysMeta: Record<string, { name: string; what: string }> = {
    quickbooks: { name: 'QuickBooks Online', what: 'Vendor invoices become bills, after your approval.' },
    salesforce: { name: 'Salesforce', what: "Documents go to the client's Account — file, summary and key facts." },
    webhooks:   { name: 'Webhooks', what: 'Signed events to Zapier, Make, n8n or your own system.' },
  };
  sysSummary: Record<string, any> = {};
  sysSends: any[] = [];
  openSys: string | null = null;
  justConnected: string | null = null;
  connectError: { sys: string; reason: string } | null = null;

  // Salesforce
  sf: any = null;
  sfForm = { client_id: '', client_secret: '', environment: 'production' };
  sfDocs: any[] = [];
  sfDraft: any = null;          // { push_id, draft, checks, edit }
  sfBusy = false;
  sfFilter = '';

  // Webhooks
  hookEvents: Record<string, string> = {};
  hooks: any[] = [];
  hookForm = { url: '', description: '', events: [] as string[] };
  hookSecret: { id: number; secret: string } | null = null;
  hookDeliveries: Record<number, any[]> = {};
  hookBusy = false;

  // Integrations list
  integrations: Integration[] = [];

  // Modal state
  mcpClientDefs = [
    { id: 'claude-desktop', label: 'Claude Desktop',    desc: 'One-click: writes config + restarts Claude Desktop automatically.',        iconBg: 'linear-gradient(135deg,#d97706,#f59e0b)', iconSvg: '<circle cx="12" cy="12" r="9"/><path fill="#d97706" d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>' },
    { id: 'cursor',         label: 'Cursor',             desc: 'One-click: writes MCP config + restarts Cursor automatically.',             iconBg: '#000',                                      iconSvg: '<path d="M4 4l8 16 2-7 7-2L4 4z"/>' },
    { id: 'windsurf',       label: 'Windsurf',           desc: 'One-click: writes MCP config + restarts Windsurf automatically.',           iconBg: 'linear-gradient(135deg,#0ea5e9,#6366f1)', iconSvg: '<path d="M3 18 L12 3 L21 18 Z"/>' },
    { id: 'vscode',         label: 'VS Code',            desc: 'One-click: adds MCP server to VS Code settings. Reload window to activate.', iconBg: '#007acc',                                  iconSvg: '<path d="M17.5 2L11 8.5 5 3 2 5.5l5.5 6L2 17.5 5 20l6-5.5 6.5 6.5 3-3-5.5-6L20 5.5z"/>' },
    { id: 'cline',          label: 'Cline',              desc: 'One-click: configures Cline VS Code extension to use UniDocVerse MCP.',     iconBg: 'linear-gradient(135deg,#7c3aed,#a855f7)', iconSvg: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>' },
    { id: 'zed',            label: 'Zed',                desc: 'One-click: adds context server config + restarts Zed automatically.',       iconBg: '#084cdf',                                   iconSvg: '<path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/>' },
    { id: 'continue',       label: 'Continue',           desc: 'One-click: writes Continue config for VS Code / JetBrains.',               iconBg: '#1f6feb',                                   iconSvg: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>' },
    { id: 'jetbrains',      label: 'JetBrains AI',       desc: 'Manual setup: add MCP server URL to JetBrains AI Assistant settings.',     iconBg: 'linear-gradient(135deg,#e5192a,#ff6b35)', iconSvg: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>' },
    { id: 'amazonq',        label: 'Amazon Q',           desc: 'Manual setup: configure MCP endpoint in Amazon Q Developer settings.',      iconBg: 'linear-gradient(135deg,#ff9900,#ffb84d)', iconSvg: '<path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 12 7z"/>' },
    { id: 'roocode',        label: 'Roo Code',           desc: 'One-click: configures Roo Code VS Code extension with MCP server URL.',    iconBg: 'linear-gradient(135deg,#10b981,#34d399)', iconSvg: '<path d="M12 3L2 9v6l10 6 10-6V9L12 3zm0 2.5L20 10v4l-8 4.8L4 14v-4l8-4.5z"/>' },
  ];

  activeModal:      string | null = null;
  modalTab:         'scan' | 'manual' = 'scan';
  form:             Record<string, string> = {};
  saving            = false;
  modalError        = '';
  testing:          string | null = null;
  inlineScanOpen    = false;

  // Scanner state
  scanStreaming     = false;
  scanStarting      = false;
  scanDetected      = false;
  scanError         = '';
  scanApiSupported  = false;
  scannedValue      = '';
  private scanStream:   MediaStream | null = null;
  private scanInterval: any = null;
  private scanDetector: any = null;

  // WhatsApp Web QR state
  waState     = 'idle';    // idle | starting | qr | authenticated | disconnected

  waQR:       string | null = null;
  waError     = '';
  waCountdown = 60;
  private waPollTimer:      any = null;
  private waCountdownTimer: any = null;


  // MCP
  mcpHitl         = true;
  mcpServerOnline = false;
  mcpCopied       = false;
  snippetCopied   = '';
  mcpClients: Record<string, boolean> = {};
  readonly MCP_SSE_URL = 'http://localhost:7979/mcp/sse';

  // MCP activation modal
  mcpActivation: {
    client: string;
    label: string;
    icon: string;
    autoConfigured: boolean;
    configPath: string;
    snippet: string;
    verifyPrompt: string;
    steps: { title: string; desc: string; cmd?: string }[];
  } | null = null;
  activationCopied = false;
  copiedCmd = '';

  readonly curlSseCmd = 'curl -N -H "Accept: text/event-stream" http://localhost:7979/mcp/sse';
  readonly mcpInspectorCmd = 'npx @modelcontextprotocol/inspector sse http://localhost:7979/mcp/sse';

  readonly toolsListCmd = `# Step 1 — open SSE stream (keep this terminal open):
curl -N -H "Accept: text/event-stream" http://localhost:7979/mcp/sse
# You'll see: data: {"type":"endpoint","uri":"/mcp/messages/?session_id=<ID>"}

# Step 2 — in a NEW terminal, paste the session URL from above:
curl -X POST "http://localhost:7979/mcp/messages/?session_id=<ID>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;

  // Fetched from backend (contains real absolute paths)
  claudeDesktopSnippetRaw = '';

  get claudeDesktopSnippet(): string {
    return this.claudeDesktopSnippetRaw ||
      JSON.stringify({ mcpServers: { unidocverse: { command: '<python>', args: ['<mcp_stdio_bridge.py>'] } } }, null, 2);
  }

  clientSnippet(client: string): string {
    if (client === 'claude-desktop') return this.claudeDesktopSnippet;
    const snippets: Record<string, any> = {
      'cursor':         { mcpServers: { unidocverse: { url: this.MCP_SSE_URL, transport: 'sse' } } },
      'zed':            { context_servers: { unidocverse: { command: { url: this.MCP_SSE_URL } } } },
      'continue':       { experimental: { modelContextProtocolServers: [{ transport: { type: 'sse', url: this.MCP_SSE_URL } }] } },
      'windsurf':       { mcpServers: { unidocverse: { serverUrl: this.MCP_SSE_URL, transport: 'sse' } } },
    };
    return JSON.stringify(snippets[client] || { url: this.MCP_SSE_URL }, null, 2);
  }

  private loadClaudeDesktopSnippet(): void {
    this.http.get<any>('http://localhost:7979/api/mcp/claude-desktop-snippet').subscribe({
      next: (res) => { this.claudeDesktopSnippetRaw = res.snippet; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  loadMcpSettings(): void {
    this.http.get<any>('http://localhost:7979/api/mcp/settings').subscribe({
      next: (s) => {
        this.mcpHitl = s.hitl_enabled ?? true;
        const enabled: string[] = s.enabled_clients ?? [];
        this.mcpClients = {};
        enabled.forEach((c: string) => this.mcpClients[c] = true);
        this.mcpServerOnline = true;
        this.cdr.markForCheck();
      },
      error: () => { this.mcpServerOnline = false; this.cdr.markForCheck(); }
    });
  }

  saveMcpSettings(): void {
    const enabled = Object.keys(this.mcpClients).filter(k => this.mcpClients[k]);
    this.http.post('http://localhost:7979/api/mcp/settings', {
      hitl_enabled: this.mcpHitl,
      enabled_clients: enabled
    }).subscribe({ error: () => {} });
  }

  private MCP_CLIENT_META: Record<string, {
    label: string; icon: string; configPath: string;
    steps: { title: string; desc: string; cmd?: string }[];
    verifyPrompt: string;
  }> = {
    'claude-desktop': {
      label: 'Claude Desktop', icon: '🤖',
      configPath: '~/Library/Application Support/Claude/claude_desktop_config.json',
      verifyPrompt: 'List your available UniDocVerse tools',
      steps: [
        {
          title: 'Config written — stdio bridge mode',
          desc: 'The config was merged into <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>. Claude Desktop uses <strong>stdio</strong> transport: it launches the bridge script directly, which calls <code>localhost:7979</code> in the background. <em>Keep the UniDocVerse backend running while using Claude Desktop.</em>',
        },
        {
          title: 'Fully quit Claude Desktop',
          desc: 'Claude Desktop only reads its config at startup. Press <kbd>⌘Q</kbd> (don\'t just close the window), then reopen.',
          cmd: 'osascript -e \'quit app "Claude"\'',
        },
        {
          title: 'Reopen Claude Desktop',
          desc: 'Launch Claude Desktop. The bridge script starts automatically — no separate terminal needed.',
          cmd: 'open -a "Claude"',
        },
        {
          title: 'Confirm tools are active',
          desc: 'Click the <strong>🔌 plug icon</strong> in the Claude Desktop toolbar — you should see <em>UniDocVerse</em> listed. Then try this prompt:',
          cmd: 'List your available UniDocVerse tools',
        },
      ],
    },
    'cursor': {
      label: 'Cursor', icon: '⌨️',
      configPath: '~/.cursor/mcp.json',
      verifyPrompt: '@unidocverse list_documents',
      steps: [
        {
          title: 'Config file written',
          desc: 'The entry was written to <code>~/.cursor/mcp.json</code>. Cursor picks this up automatically — no manual edits needed.',
        },
        {
          title: 'Reload the Cursor window',
          desc: 'Press <kbd>⌘⇧P</kbd> to open the command palette, then run:',
          cmd: 'Developer: Reload Window',
        },
        {
          title: 'Confirm tools are active',
          desc: 'Open <strong>Cursor Settings → Features → MCP</strong> and verify <em>unidocverse</em> shows a green status dot. Then try in Cursor chat:',
          cmd: '@unidocverse list_documents',
        },
      ],
    },
    'zed': {
      label: 'Zed', icon: '⚡',
      configPath: '~/.config/zed/settings.json',
      verifyPrompt: '/unidocverse list_documents',
      steps: [
        {
          title: 'Config file written',
          desc: 'The <code>context_servers.unidocverse</code> entry was merged into <code>~/.config/zed/settings.json</code>.',
        },
        {
          title: 'Restart Zed',
          desc: 'Quit Zed fully (<kbd>⌘Q</kbd>) and reopen it — context servers are initialised at startup only.',
          cmd: 'pkill -x "Zed" ; sleep 1 ; open -a "Zed"',
        },
        {
          title: 'Confirm in the AI assistant panel',
          desc: 'Open the assistant panel with <kbd>⌘/</kbd>. In the context menu you should see <em>UniDocVerse</em> as an available server. Try:',
          cmd: '/unidocverse list_documents',
        },
      ],
    },
    'continue': {
      label: 'Continue (VS Code)', icon: '🔵',
      configPath: '~/.continue/config.json',
      verifyPrompt: '@UniDocVerse list my documents',
      steps: [
        {
          title: 'Config file written',
          desc: 'A UniDocVerse entry was appended to <code>~/.continue/config.json</code> under <code>experimental.modelContextProtocolServers</code>.',
        },
        {
          title: 'Reload the VS Code window',
          desc: 'Press <kbd>⌘⇧P</kbd> and run:',
          cmd: 'Developer: Reload Window',
        },
        {
          title: 'Confirm tools are active',
          desc: 'Open the Continue sidebar (Continue icon in the activity bar). Click the ⊕ context menu — you should see UniDocVerse. Try in chat:',
          cmd: '@UniDocVerse list my documents',
        },
      ],
    },
    'windsurf': {
      label: 'Windsurf', icon: '🏄',
      configPath: '~/.codeium/windsurf/mcp_config.json',
      verifyPrompt: 'Use UniDocVerse to list my documents',
      steps: [
        {
          title: 'Config file written',
          desc: 'The entry was written to <code>~/.codeium/windsurf/mcp_config.json</code> under <code>mcpServers</code>.',
        },
        {
          title: 'Restart Windsurf',
          desc: 'Quit Windsurf (<kbd>⌘Q</kbd>) and reopen it so it loads the new MCP server.',
          cmd: 'pkill -x "Windsurf" ; sleep 1 ; open -a "Windsurf"',
        },
        {
          title: 'Confirm tools in Cascade',
          desc: 'Open the Cascade panel. Click the <strong>⚡ tools icon</strong> — <em>UniDocVerse</em> should appear. Try this prompt:',
          cmd: 'Use UniDocVerse to list my documents',
        },
      ],
    },
  };

  // Tracks which MCP client cards are in "connecting" state
  mcpConnecting: Record<string, boolean> = {};
  // After connect — shows a small inline result per card: 'ok' | 'already' | 'manual' | 'err'
  mcpConnectResult: Record<string, 'ok' | 'already' | 'manual' | 'err'> = {};

  enableMcpClient(client: string): void {
    this.mcpClients = { ...this.mcpClients, [client]: true };
    this.saveMcpSettings();
    this.mcpConnecting = { ...this.mcpConnecting, [client]: true };
    this.mcpConnectResult = { ...this.mcpConnectResult, [client]: undefined as any };
    this.cdr.markForCheck();

    this.http.post<any>('http://localhost:7979/api/mcp/connect-client', { client })
      .subscribe({
        next: (res) => {
          this.mcpConnecting = { ...this.mcpConnecting, [client]: false };
          const label = this.MCP_CLIENT_META[client]?.label || client;
          if (res.status === 'not_installed') {
            this.mcpConnectResult = { ...this.mcpConnectResult, [client]: 'manual' };
            this.showToast(`${label} not found — copy the config snippet manually.`, true);
          } else if (res.restarted) {
            this.mcpConnectResult = { ...this.mcpConnectResult, [client]: 'ok' };
            this.showToast(`✅ ${label} configured and restarted — tools are live!`);
          } else {
            this.mcpConnectResult = { ...this.mcpConnectResult, [client]: 'already' };
            this.showToast(`${label} already configured.`);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.mcpConnecting = { ...this.mcpConnecting, [client]: false };
          this.mcpConnectResult = { ...this.mcpConnectResult, [client]: 'manual' };
          const label = this.MCP_CLIENT_META[client]?.label || client;
          this.showToast(`${label}: config written — restart the app manually.`, false);
          this.cdr.markForCheck();
        },
      });
  }

  disableMcpClient(client: string): void {
    this.mcpClients = { ...this.mcpClients, [client]: false };
    this.saveMcpSettings();
  }

  closeMcpActivation(): void {
    this.mcpActivation = null;
    this.cdr.markForCheck();
  }

  copyActivationSnippet(): void {
    if (!this.mcpActivation) return;
    navigator.clipboard.writeText(this.mcpActivation.snippet).then(() => {
      this.activationCopied = true;
      setTimeout(() => { this.activationCopied = false; this.cdr.markForCheck(); }, 2000);
      this.cdr.markForCheck();
    });
  }

  copyCmd(cmd: string): void {
    navigator.clipboard.writeText(cmd).then(() => {
      this.copiedCmd = cmd;
      setTimeout(() => { this.copiedCmd = ''; this.cdr.markForCheck(); }, 2000);
      this.cdr.markForCheck();
    });
  }

  copyMcpUrl(): void {
    navigator.clipboard.writeText(this.MCP_SSE_URL).then(() => {
      this.mcpCopied = true;
      setTimeout(() => { this.mcpCopied = false; this.cdr.markForCheck(); }, 2000);
      this.cdr.markForCheck();
    });
  }

  copySnippet(client: string): void {
    navigator.clipboard.writeText(this.clientSnippet(client)).then(() => {
      this.snippetCopied = client;
      setTimeout(() => { this.snippetCopied = ''; this.cdr.markForCheck(); }, 2000);
      this.cdr.markForCheck();
    });
  }

  // Toast
  toast    = '';
  toastErr = false;
  private toastTimer: any;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.loadModels();
    this.loadProviders();
    this.loadRoles();
    this.loadQuickBooks();
    this.loadSalesforce();
    this.loadHooks();

    this.loadSysSummary();
    const qs = new URLSearchParams(window.location.search);
    for (const [param, sys] of [['qb', 'quickbooks'], ['sf', 'salesforce']]) {
      if (qs.get(param) === 'connected') { this.justConnected = sys; this.openSystem(sys); }
      if (qs.get(param) === 'error') { this.connectError = { sys, reason: qs.get('reason') || 'unknown error' }; this.openSystem(sys); }
    }
    if (qs.get('qb') || qs.get('sf')) history.replaceState(null, '', window.location.pathname);
    this.loadIntegrations();
    this.loadMcpSettings();
    this.loadClaudeDesktopSnippet();
    this.initScanDetector();
  }

  ngOnDestroy(): void {
    this.stopModalScan();
    this.stopWaPoll();
  }

  private loadModels(): void {
    this.http.get<{ installed_models: string[] }>('http://localhost:7979/api/models/list-models').subscribe({
      next: (res) => { this.models = res.installed_models; this.loadingModels = false; this.cdr.markForCheck(); },
      error: () => { this.loadingModels = false; this.cdr.markForCheck(); }
    });
    this.http.get<{ selected_model: string }>('http://localhost:7979/api/models/get-model').subscribe({
      next: (res) => { this.currentModel = res.selected_model; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  private readonly providersApi = 'http://localhost:7979/api/llm-providers';
  private readonly webApi = 'http://localhost:7979/api/web-search';
  private readonly qbApi = 'http://localhost:7979/api/quickbooks';
  private readonly hooksApi = 'http://localhost:7979/api/webhooks';

  // ── QuickBooks ─────────────────────────────────────────────────────────────
  loadQuickBooks(): void {
    this.http.get<any>(`${this.qbApi}/status`).subscribe({
      next: (s) => {
        this.qb = s;
        this.qbForm = { client_id: s.client_id || '', client_secret: '', environment: s.environment || 'sandbox' };
        if (s.connected) { this.loadQbAccounts(); this.loadQbBills(); }
        this.loadSysSummary();
        this.cdr.markForCheck();
      },
      error: () => { this.qb = null; this.cdr.markForCheck(); }
    });
  }

  saveQbApp(): void {
    this.qbBusy = true;
    this.http.put(`${this.qbApi}/app`, { ...this.qbForm, client_secret: this.qbForm.client_secret || null }).subscribe({
      next: () => { this.qbBusy = false; this.showToast('QuickBooks app saved'); this.loadQuickBooks(); },
      error: (e) => { this.qbBusy = false; this.showToast(e?.error?.detail || 'Could not save', true); this.cdr.markForCheck(); }
    });
  }

  connectQb(): void {
    this.http.get<{ url: string }>(`${this.qbApi}/connect`).subscribe({
      next: (r) => { window.location.href = r.url; },
      error: (e) => this.showToast(e?.error?.detail || 'Could not start QuickBooks sign-in', true)
    });
  }

  disconnectQb(): void {
    this.http.post(`${this.qbApi}/disconnect`, {}).subscribe({
      next: () => { this.showToast('QuickBooks disconnected'); this.loadQuickBooks(); },
      error: () => this.showToast('Could not disconnect', true)
    });
  }

  loadQbAccounts(): void {
    this.http.get<{ accounts: any[] }>(`${this.qbApi}/accounts`).subscribe({
      next: (r) => { this.qbAccounts = r.accounts; this.cdr.markForCheck(); },
      error: (e) => this.showToast(e?.error?.detail || 'Could not load QuickBooks accounts', true)
    });
  }

  setQbAccount(id: string): void {
    this.http.put(`${this.qbApi}/expense-account`, { expense_account_id: id }).subscribe({
      next: () => { if (this.qb) this.qb.expense_account_id = id; this.showToast('Expense account saved'); },
      error: () => this.showToast('Could not save', true)
    });
  }

  loadQbBills(): void {
    this.http.get<{ bills: any[] }>(`${this.qbApi}/bills`).subscribe({
      next: (r) => { this.qbBills = r.bills; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  prepareBill(docId: string): void {
    this.qbBusy = true;
    this.http.post<any>(`${this.qbApi}/bills/prepare/${docId}`, {}).subscribe({
      next: (r) => {
        this.qbDraft = { push_id: r.id, draft: r.draft, checks: r.checks,
                         edit: { vendor: r.draft.vendor, total: r.draft.total, bill_date: r.draft.bill_date,
                                 due_date: r.draft.due_date, doc_number: r.draft.doc_number } };
        this.qbBusy = false; this.cdr.markForCheck();
      },
      error: (e) => { this.qbBusy = false; this.showToast(e?.error?.detail || 'Could not prepare the bill', true); this.cdr.markForCheck(); }
    });
  }

  get qbDraftOk(): boolean { return !!this.qbDraft && this.qbDraft.checks.every((c: any) => c.ok); }

  approveBill(): void {
    if (!this.qbDraft) return;
    this.qbBusy = true;
    this.http.post<any>(`${this.qbApi}/bills/${this.qbDraft.push_id}/approve`, this.qbDraft.edit).subscribe({
      next: (r) => {
        this.qbBusy = false; this.qbDraft = null;
        this.showToast(`Bill ${r.bill_id} created in QuickBooks`); this.loadQbBills(); this.afterSend();
      },
      error: (e) => { this.qbBusy = false; this.showToast(e?.error?.detail || 'QuickBooks rejected the bill', true); this.loadQbBills(); this.cdr.markForCheck(); }
    });
  }

  discardBill(): void {
    if (!this.qbDraft) return;
    this.http.post(`${this.qbApi}/bills/${this.qbDraft.push_id}/discard`, {}).subscribe({
      next: () => { this.qbDraft = null; this.loadQbBills(); this.cdr.markForCheck(); }
    });
  }

  // ── Outbound systems ───────────────────────────────────────────────────────
  loadSysSummary(): void {
    this.http.get<any>('http://localhost:7979/api/integrations/summary').subscribe({
      next: (r) => { this.sysSummary = r || {}; this.cdr.markForCheck(); }, error: () => {} });
  }

  openSystem(k: string): void {
    this.openSys = k;
    this.sysSends = [];
    this.http.get<any>(`http://localhost:7979/api/integrations/sends?system=${k}&limit=30`).subscribe({
      next: (r) => { if (this.openSys === k) { this.sysSends = r.sends || []; this.cdr.markForCheck(); } }, error: () => {} });
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape') onEsc(): void { if (this.openSys) this.closeSystem(); }

  closeSystem(): void {
    this.openSys = null; this.justConnected = null; this.connectError = null;
    this.cdr.markForCheck();
  }

  private afterSend(): void {
    this.loadSysSummary();
    if (this.openSys) this.openSystem(this.openSys);
  }

  // ── Salesforce ─────────────────────────────────────────────────────────────
  private readonly sfApi = 'http://localhost:7979/api/salesforce';

  loadSalesforce(): void {
    this.http.get<any>(`${this.sfApi}/status`).subscribe({
      next: (s) => {
        this.sf = s;
        const env = s.login_host === 'https://test.salesforce.com' ? 'sandbox'
          : s.login_host === 'https://login.salesforce.com' ? 'production' : s.login_host;
        this.sfForm = { client_id: s.client_id || '', client_secret: '', environment: env || 'production' };
        if (s.connected) this.loadSfDocs();
        this.loadSysSummary();
        this.cdr.markForCheck();
      },
      error: () => { this.sf = null; this.cdr.markForCheck(); }
    });
  }

  saveSfApp(): void {
    this.sfBusy = true;
    this.http.put(`${this.sfApi}/app`, { ...this.sfForm, client_secret: this.sfForm.client_secret || null }).subscribe({
      next: () => { this.sfBusy = false; this.showToast('Salesforce app saved'); this.loadSalesforce(); },
      error: (e) => { this.sfBusy = false; this.showToast(e?.error?.detail || 'Could not save', true); this.cdr.markForCheck(); }
    });
  }

  connectSf(): void {
    this.http.get<{ url: string }>(`${this.sfApi}/connect`).subscribe({
      next: (r) => { window.location.href = r.url; },
      error: (e) => this.showToast(e?.error?.detail || 'Could not start Salesforce sign-in', true)
    });
  }

  disconnectSf(): void {
    this.http.post(`${this.sfApi}/disconnect`, {}).subscribe({
      next: () => { this.showToast('Salesforce disconnected'); this.loadSalesforce(); },
      error: () => this.showToast('Could not disconnect', true)
    });
  }

  loadSfDocs(): void {
    this.http.get<{ documents: any[] }>(`${this.sfApi}/documents`).subscribe({
      next: (r) => { this.sfDocs = r.documents; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  get sfDocsShown(): any[] {
    const q = this.sfFilter.trim().toLowerCase();
    return q ? this.sfDocs.filter(d => (d.filename + ' ' + (d.doc_type || '')).toLowerCase().includes(q)) : this.sfDocs;
  }

  prepareSf(docId: string): void {
    this.sfBusy = true;
    this.http.post<any>(`${this.sfApi}/documents/prepare/${docId}`, {}).subscribe({
      next: (r) => {
        this.sfDraft = { push_id: r.id, draft: r.draft, checks: r.checks,
                         edit: { account_name: r.draft.account_name, subject: r.draft.subject } };
        this.sfBusy = false; this.cdr.markForCheck();
      },
      error: (e) => { this.sfBusy = false; this.showToast(e?.error?.detail || 'Could not prepare', true); this.cdr.markForCheck(); }
    });
  }

  approveSf(): void {
    if (!this.sfDraft) return;
    this.sfBusy = true;
    this.http.post<any>(`${this.sfApi}/pushes/${this.sfDraft.push_id}/approve`, this.sfDraft.edit).subscribe({
      next: (r) => {
        this.sfBusy = false; this.sfDraft = null;
        this.showToast(`Sent to Salesforce — ${r.account_id}`); this.loadSfDocs(); this.afterSend();
      },
      error: (e) => { this.sfBusy = false; this.showToast(e?.error?.detail || 'Salesforce rejected it', true); this.loadSfDocs(); this.cdr.markForCheck(); }
    });
  }

  discardSf(): void {
    if (!this.sfDraft) return;
    this.http.post(`${this.sfApi}/pushes/${this.sfDraft.push_id}/discard`, {}).subscribe({
      next: () => { this.sfDraft = null; this.loadSfDocs(); this.cdr.markForCheck(); }
    });
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────
  loadHooks(): void {
    this.http.get<any>(this.hooksApi).subscribe({
      next: (r) => { this.hooks = r.endpoints; this.hookEvents = r.events; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  get hookEventKeys(): string[] { return Object.keys(this.hookEvents); }

  toggleHookEvent(e: string): void {
    const set = new Set(this.hookForm.events);
    set.has(e) ? set.delete(e) : set.add(e);
    this.hookForm.events = Array.from(set);
  }

  addHook(): void {
    this.hookBusy = true;
    this.http.post<{ id: number; secret: string }>(this.hooksApi, this.hookForm).subscribe({
      next: (r) => {
        this.hookBusy = false; this.hookSecret = r;
        this.hookForm = { url: '', description: '', events: [] };
        this.loadHooks(); this.cdr.markForCheck();
      },
      error: (e) => { this.hookBusy = false; this.showToast(e?.error?.detail || 'Could not add webhook', true); this.cdr.markForCheck(); }
    });
  }

  testHook(id: number): void {
    this.http.post<any>(`${this.hooksApi}/${id}/test`, {}).subscribe({
      next: (r) => { this.showToast(r.ok ? `Test delivered (HTTP ${r.status_code})` : `Test failed: ${r.status_code || ''} ${r.response || ''}`, !r.ok); this.showDeliveries(id, true); },
      error: (e) => this.showToast(e?.error?.detail || 'Test failed', true)
    });
  }

  deleteHook(id: number): void {
    this.http.delete(`${this.hooksApi}/${id}`).subscribe({ next: () => { this.loadHooks(); this.showToast('Webhook removed'); } });
  }

  showDeliveries(id: number, force = false): void {
    if (this.hookDeliveries[id] && !force) { delete this.hookDeliveries[id]; this.cdr.markForCheck(); return; }
    this.http.get<any>(`${this.hooksApi}/${id}/deliveries`).subscribe({
      next: (r) => { this.hookDeliveries[id] = r.deliveries; this.cdr.markForCheck(); }
    });
  }

  redeliver(deliveryId: number, endpointId: number): void {
    this.http.post<any>(`${this.hooksApi}/deliveries/${deliveryId}/redeliver`, {}).subscribe({
      next: (r) => { this.showToast(r.ok ? 'Redelivered' : 'Still failing', !r.ok); this.showDeliveries(endpointId, true); }
    });
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.showToast('Copied'));
  }

  // ── Web search (SearxNG) ───────────────────────────────────────────────────
  webCfg: { enabled: boolean; searxng_url: string } | null = null;
  webBusy = false;

  loadWeb(): void {
    this.http.get<any>(`${this.webApi}/settings`).subscribe({
      next: (r) => { this.webCfg = { enabled: !!r.enabled, searxng_url: r.searxng_url || '' }; this.cdr.markForCheck(); },
      error: () => {} });
  }

  testWeb(): void {
    if (!this.webCfg) return;
    this.webBusy = true;
    this.http.post<any>(`${this.webApi}/test`, this.webCfg).subscribe({
      next: (r) => { this.webBusy = false; this.showToast(`SearxNG answered with ${r.results} results`); this.cdr.markForCheck(); },
      error: (e) => { this.webBusy = false; this.showToast(e?.error?.detail || 'SearxNG did not answer', true); this.cdr.markForCheck(); } });
  }

  saveWeb(): void {
    if (!this.webCfg) return;
    this.webBusy = true;
    this.http.put<any>(`${this.webApi}/settings`, this.webCfg).subscribe({
      next: (r) => { this.webBusy = false; this.webCfg = { enabled: r.enabled, searxng_url: r.searxng_url }; this.showToast(r.enabled ? 'Web search is on' : 'Web search is off'); this.cdr.markForCheck(); },
      error: (e) => { this.webBusy = false; this.showToast(e?.error?.detail || 'Only admins can change this', true); this.cdr.markForCheck(); } });
  }

  // ── Model roles ────────────────────────────────────────────────────────────
  roles: any[] = [];
  vision: { model: string; installed: boolean; pull: string } | null = null;
  roleLocalModels: string[] = [];
  roleClouds: { provider: string; label: string; model: string }[] = [];

  loadVision(): void {
    this.http.get<any>(`${this.providersApi}/engine-status`).subscribe({
      next: (e) => { this.vision = e?.vision || null; this.cdr.markForCheck(); }, error: () => {} });
  }

  loadRoles(): void {
    this.loadVision();
    this.http.get<any>(`${this.providersApi}/model-roles`).subscribe({
      next: (r) => { this.roles = r.roles || []; this.roleLocalModels = r.local_models || []; this.roleClouds = r.cloud_providers || []; this.cdr.markForCheck(); },
      error: () => { this.roles = []; this.cdr.markForCheck(); }
    });
  }

  roleValue(r: any): string {
    const c = r.current;
    if (!c) return '';
    return c.engine === 'cloud' ? `cloud|${c.provider}|${c.model}` : `local|${c.model}`;
  }

  setRole(r: any, value: string): void {
    const done = (msg: string) => { this.showToast(msg); this.loadRoles(); };
    const fail = (e: any) => { this.showToast(e?.error?.detail || 'Could not save', true); this.loadRoles(); };
    if (!value) {
      this.http.delete(`${this.providersApi}/model-roles/${r.role}`).subscribe({ next: () => done(`${r.label} uses the default model`), error: fail });
      return;
    }
    const [engine, a, b] = value.split('|');
    const body = engine === 'cloud' ? { engine, provider: a, model: b } : { engine, model: a };
    this.http.put(`${this.providersApi}/model-roles/${r.role}`, body).subscribe({
      next: () => done(`${r.label} now uses ${engine === 'cloud' ? b : a}`), error: fail });
  }

  loadProviders(): void {
    this.http.get<{ providers: CloudProvider[]; active: string | null }>(this.providersApi).subscribe({
      next: (res) => { this.providers = res.providers; this.activeProvider = res.active; this.loadPolicy(); this.loadWeb(); this.cdr.markForCheck(); },
      error: () => { this.providers = []; this.cdr.markForCheck(); }   // non-admins get 403: section stays hidden
    });
  }

  loadPolicy(): void {
    this.http.get<any>(`${this.providersApi}/policy`).subscribe({
      next: (r) => {
        this.policy = {
          ask_before_send: r.ask_before_send, mask_identifiers: r.mask_identifiers, blocked_types: r.blocked_types,
          upload_cloud: r.upload_cloud, upload_types: r.upload_types || [], upload_model: r.upload_model,
          monthly_budget_usd: r.monthly_budget_usd, cascade_local_first: r.cascade_local_first !== false,
        };
        this.monthSpend = r.month_spend_usd || 0;
        this.knownTypes = r.known_types; this.cdr.markForCheck();
      },
      error: () => {}
    });
    this.http.get<any>(`${this.providersApi}/usage?days=30`).subscribe({
      next: (r) => { this.usage = r; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  isBlocked(t: string): boolean { return !!this.policy?.blocked_types.includes(t); }

  isUploadType(t: string): boolean { return !!this.policy?.upload_types.includes(t); }

  /** Types that may be chosen for cloud extraction: never-send types are excluded. */
  get uploadCandidates(): string[] { return this.knownTypes.filter(t => !this.isBlocked(t)); }

  toggleUploadType(t: string): void {
    if (!this.policy) return;
    const set = new Set(this.policy.upload_types);
    set.has(t) ? set.delete(t) : set.add(t);
    this.policy.upload_types = Array.from(set).sort();
    this.savePolicy();
  }

  onBudgetChange(v: string | number | null): void {
    if (!this.policy) return;
    const n = v === '' || v === null ? null : Number(v);
    this.policy.monthly_budget_usd = n === null || isNaN(n) ? null : n;
    this.savePolicy();
  }

  toggleBlocked(t: string): void {
    if (!this.policy) return;
    const set = new Set(this.policy.blocked_types);
    set.has(t) ? set.delete(t) : set.add(t);
    this.policy.blocked_types = Array.from(set).sort();
    this.policy.upload_types = this.policy.upload_types.filter(x => !set.has(x));   // never-send wins
    this.savePolicy();
  }

  savePolicy(): void {
    if (!this.policy) return;
    this.policySaving = true;
    this.http.put(`${this.providersApi}/policy`, this.policy).subscribe({
      next: () => { this.policySaving = false; this.cdr.markForCheck(); },
      error: () => { this.policySaving = false; this.showToast('Could not save data protection settings', true); this.cdr.markForCheck(); }
    });
  }

  typeLabel(t: string): string { return t.replace(/_/g, ' '); }

  get activeProviderLabel(): string {
    return this.providers.find(p => p.provider === this.activeProvider)?.label ?? '';
  }

  openProvider(p: CloudProvider): void {
    this.editing = p;
    this.editKey = '';
    this.editModel = p.model || p.default_model || '';
    this.editUrl = p.base_url || '';
    this.testResult = null;
    this.modelOptions = [...p.models];
    this.customModel = false;
    this.modelsNote = '';
    if (p.configured) this.loadProviderModels();
    this.cdr.markForCheck();
  }

  /** Ask the provider which models this key can use; the admin can still type any id. */
  loadProviderModels(): void {
    if (!this.editing || (!this.editKey.trim() && !this.editing.configured)) return;
    if (this.editing.needs_url && !this.editUrl.trim() && !this.editing.base_url) return;
    const pinned = this.editing.models;
    this.modelsLoading = true;
    this.modelsNote = '';
    this.http.post<{ models: string[]; error: string | null }>(
      `${this.providersApi}/${this.editing.provider}/models`, this.providerBody()).subscribe({
      next: (r) => {
        this.modelOptions = Array.from(new Set([...pinned, ...r.models]));
        const rejected = !!r.error && /401|403|authentication|api key|invalid.*key/i.test(r.error);
        this.modelsNote = rejected ? `${this.editing?.label} rejected this API key — check it and try again.`
                        : r.error ? "This provider didn't return a model list. Choose Other and type the model id."
                        : r.models.length ? '' : 'No models returned for this key.';
        if (!this.editModel && this.modelOptions.length) this.editModel = this.modelOptions[0];
        this.customModel = !!this.editModel && !this.modelOptions.includes(this.editModel);
        this.modelsLoading = false; this.cdr.markForCheck();
      },
      error: () => { this.modelsLoading = false; this.modelsNote = 'Could not load models.'; this.cdr.markForCheck(); }
    });
  }

  onModelPick(value: string): void {
    this.customModel = value === this.OTHER;
    this.editModel = this.customModel ? '' : value;
    this.cdr.markForCheck();
  }

  closeProvider(): void { this.editing = null; this.cdr.markForCheck(); }

  private providerBody() {
    return { api_key: this.editKey.trim() || null, model: this.editModel.trim(), base_url: this.editUrl.trim() || null };
  }

  testProvider(): void {
    if (!this.editing || this.providerBusy) return;
    this.providerBusy = true;
    this.testResult = null;
    this.http.post<{ success: boolean; reply?: string; error?: string }>(
      `${this.providersApi}/${this.editing.provider}/test`, this.providerBody()).subscribe({
      next: (r) => {
        this.testResult = r.success ? { ok: true, text: `Connected — model replied "${r.reply}"` }
                                    : { ok: false, text: r.error || 'Connection failed' };
        this.providerBusy = false; this.cdr.markForCheck();
      },
      error: (e) => {
        this.testResult = { ok: false, text: e?.error?.detail || 'Connection failed' };
        this.providerBusy = false; this.cdr.markForCheck();
      }
    });
  }

  saveProvider(activate = false): void {
    if (!this.editing || this.providerBusy) return;
    const provider = this.editing.provider;
    this.providerBusy = true;
    this.http.put(`${this.providersApi}/${provider}`, this.providerBody()).subscribe({
      next: () => {
        this.providerBusy = false;
        if (activate) { this.setActiveProvider(provider); } else { this.showToast('Saved'); this.loadProviders(); }
        this.editing = null; this.cdr.markForCheck();
      },
      error: (e) => { this.providerBusy = false; this.showToast(e?.error?.detail || 'Could not save', true); this.cdr.markForCheck(); }
    });
  }

  setActiveProvider(provider: string | null): void {
    this.http.post<{ active: string | null }>(`${this.providersApi}/activate`, { provider }).subscribe({
      next: (r) => {
        this.activeProvider = r.active;
        this.showToast(r.active ? `Answers now use ${this.activeProviderLabel || r.active}` : `Answers now use the local model (${this.currentModel})`);
        this.loadProviders();
      },
      error: (e) => this.showToast(e?.error?.detail || 'Could not switch', true)
    });
  }

  removeProvider(): void {
    if (!this.editing) return;
    const p = this.editing;
    this.http.delete(`${this.providersApi}/${p.provider}`).subscribe({
      next: () => { this.editing = null; this.showToast(`${p.label} key removed`); this.loadProviders(); },
      error: () => this.showToast('Could not remove', true)
    });
  }

  private loadIntegrations(): void {
    this.http.get<{ integrations: Integration[] }>('http://localhost:7979/api/integrations').subscribe({
      next: (res) => { this.integrations = res.integrations; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  getIntegration(provider: string): Integration | undefined {
    return this.integrations.find(i => i.provider === provider);
  }

  getLabel(provider: string): string {
    const labels: Record<string, string> = {
      whatsapp: 'WhatsApp', telegram: 'Telegram', discord: 'Discord',
      slack: 'Slack', teams: 'Microsoft Teams'
    };
    return labels[provider] || provider;
  }

  openModal(provider: string): void {
    this.activeModal     = provider;
    this.modalTab        = provider === 'whatsapp' ? 'scan' : 'manual';
    this.form            = {};
    this.modalError      = '';
    this.saving          = false;
    this.inlineScanOpen  = false;
    this.scannedValue    = '';
    this.scanDetected    = false;
    this.scanError       = '';
    this.stopModalScan();
  }

  closeModal(): void {
    this.activeModal = null;
    this.form = {};
    this.modalError = '';
  }

  saveIntegration(): void {
    if (!this.activeModal) return;
    this.modalError = '';

    // ── Frontend validation ──────────────────────────────────────────────────
    const p = this.activeModal;
    const f = this.form;

    if (p === 'whatsapp') {
      if (!f['account_sid']?.trim())  { this.modalError = 'Account SID is required.'; return; }
      if (!f['auth_token']?.trim())   { this.modalError = 'Auth Token is required.'; return; }
      if (!f['from_number']?.trim())  { this.modalError = 'From Number is required.'; return; }
      if (!f['phone_number']?.trim()) { this.modalError = 'Your WhatsApp Number is required.'; return; }
      // Catch pasted URLs as phone numbers
      if (f['phone_number'].startsWith('http') || f['phone_number'].includes('wa.me/qr')) {
        this.modalError = 'That looks like a link, not a phone number. Enter your WhatsApp number like: whatsapp:+15551234567';
        return;
      }
      // Ensure whatsapp: prefix on numbers
      if (!f['phone_number'].startsWith('whatsapp:')) {
        f['phone_number'] = `whatsapp:${f['phone_number']}`;
      }
      if (!f['from_number'].startsWith('whatsapp:')) {
        f['from_number'] = `whatsapp:${f['from_number']}`;
      }
    } else if (p === 'telegram') {
      if (!f['bot_token']?.trim()) { this.modalError = 'Bot Token is required.'; return; }
      if (!f['chat_id']?.trim())   { this.modalError = 'Chat ID is required.'; return; }
    } else if (['discord', 'slack', 'teams'].includes(p)) {
      if (!f['webhook_url']?.trim()) { this.modalError = 'Webhook URL is required.'; return; }
      if (!f['webhook_url'].startsWith('http')) {
        this.modalError = 'Webhook URL must start with https://';
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    this.saving = true;

    const payload: Record<string, any> = {
      provider: this.activeModal,
      enabled: true,
      ...this.form
    };

    this.http.post<{ success: boolean }>('http://localhost:7979/api/integrations/save', payload).subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.loadIntegrations();
        this.showToast(`${this.getLabel(this.activeModal!)} connected!`);
      },
      error: (e) => {
        this.saving = false;
        const raw = e?.error?.detail || e?.message || '';
        // Humanise common API errors
        this.modalError = raw.includes('Not Found')   ? 'Twilio Account SID not found — check your credentials.'
          : raw.includes('authenticate')               ? 'Auth failed — wrong Auth Token.'
          : raw.includes('authenticate')               ? 'Auth failed — wrong Auth Token.'
          : raw.includes('not a valid phone number')   ? 'Invalid phone number format.'
          : raw || 'Save failed — check your credentials and try again.';
        this.cdr.markForCheck();
      }
    });
  }


  disconnect(provider: string): void {
    this.http.post<{ success: boolean }>('http://localhost:7979/api/integrations/disconnect', { provider }).subscribe({
      next: () => {
        this.loadIntegrations();
        this.showToast(`${this.getLabel(provider)} disconnected.`, true);
      },
      error: () => {}
    });
  }

  testIntegration(provider: string): void {
    this.testing = provider;
    this.http.post<{ success: boolean; message: string }>('http://localhost:7979/api/integrations/test', { provider }).subscribe({
      next: (res) => {
        this.testing = null;
        this.showToast(res.message || 'Test message sent!');
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.testing = null;
        this.showToast(e?.error?.detail || 'Test failed — check credentials.', true);
        this.cdr.markForCheck();
      }
    });
  }

  switchModel(modelName: string): void {
    if (this.activeProvider) {
      this.showToast(`A cloud model is active. Switch back to local under Cloud models first.`, true);
      return;
    }
    if (modelName === this.currentModel || this.switchingModel) return;
    this.switchingModel = true;
    this.http.post<{ selected_model: string }>('http://localhost:7979/api/models/set-model', {
      model_name: modelName
    }).subscribe({
      next: (res) => { this.currentModel = res.selected_model; this.switchingModel = false; this.cdr.markForCheck(); },
      error: () => { this.switchingModel = false; this.cdr.markForCheck(); }
    });
  }

  private showToast(msg: string, isErr = false): void {
    clearTimeout(this.toastTimer);
    this.toast = msg;
    this.toastErr = isErr;
    this.cdr.markForCheck();
    this.toastTimer = setTimeout(() => { this.toast = ''; this.cdr.markForCheck(); }, 3500);
  }

  // ── Scanner helpers ────────────────────────────────────────────────────────

  private initScanDetector(): void {
    const BD = (window as any)['BarcodeDetector'];
    if (!BD) { this.scanApiSupported = false; return; }
    this.scanApiSupported = true;
    BD.getSupportedFormats().then((fmts: string[]) => {
      this.scanDetector = new BD({ formats: fmts });
    }).catch(() => {
      this.scanDetector = new BD({ formats: ['qr_code', 'ean_13', 'code_128'] });
    });
  }

  setTab(tab: 'scan' | 'manual'): void {
    this.modalTab = tab;
    this.scannedValue = '';
    this.scanDetected = false;
    this.scanError    = '';
    if (tab !== 'scan') this.stopModalScan();
    this.cdr.markForCheck();
  }

  toggleInlineScanner(): void {
    this.inlineScanOpen = !this.inlineScanOpen;
    if (!this.inlineScanOpen) this.stopModalScan();
    this.scannedValue = '';
    this.cdr.markForCheck();
  }

  async startModalScan(): Promise<void> {
    if (!this.scanApiSupported) {
      this.scanError = 'BarcodeDetector not supported. Please use Chrome/Edge or upload a QR image.';
      this.cdr.markForCheck();
      return;
    }
    this.scanStarting = true;
    this.scanError    = '';
    this.cdr.markForCheck();

    try {
      this.scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false
      });

      // Wait one tick for Angular to render the <video> element
      await new Promise(r => setTimeout(r, 80));

      const video = this.modalVideoEl?.nativeElement;
      if (!video) throw new Error('Video element not ready');
      video.srcObject = this.scanStream;
      await video.play();

      this.scanStreaming = true;
      this.scanStarting  = false;
      this.cdr.markForCheck();

      // Scan every 300 ms
      this.scanInterval = setInterval(() => this.scanFrame(), 300);
    } catch (e: any) {
      this.scanStarting = false;
      this.scanError = e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access in browser settings.'
        : `Could not start camera: ${e?.message || e}`;
      this.cdr.markForCheck();
    }
  }

  stopModalScan(): void {
    clearInterval(this.scanInterval);
    this.scanStream?.getTracks().forEach(t => t.stop());
    this.scanStream   = null;
    this.scanStreaming = false;
    if (this.modalVideoEl?.nativeElement) {
      this.modalVideoEl.nativeElement.srcObject = null;
    }
    this.cdr.markForCheck();
  }

  private async scanFrame(): Promise<void> {
    if (!this.scanStreaming || !this.scanDetector) return;
    const video  = this.modalVideoEl?.nativeElement;
    const canvas = this.modalCanvasEl?.nativeElement;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    try {
      const codes = await this.scanDetector.detect(canvas);
      if (codes?.length > 0) {
        this.ngZone.run(() => {
          this.scannedValue = codes[0].rawValue;
          this.scanDetected = true;
          this.stopModalScan();
          setTimeout(() => { this.scanDetected = false; this.cdr.markForCheck(); }, 2500);
          this.cdr.markForCheck();
        });
      }
    } catch { /* detector not ready */ }
  }

  async onModalFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.scanDetector) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src   = url;
    await new Promise(r => img.onload = r);

    const canvas = this.modalCanvasEl?.nativeElement;
    if (!canvas) return;
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    try {
      const codes = await this.scanDetector.detect(canvas);
      if (codes?.length > 0) {
        this.scannedValue = codes[0].rawValue;
        this.scanDetected = true;
        this.cdr.markForCheck();
      } else {
        this.scanError = 'No QR code found in this image.';
        this.cdr.markForCheck();
      }
    } catch (e: any) {
      this.scanError = 'Could not scan image: ' + (e?.message || e);
      this.cdr.markForCheck();
    }
    // reset file input
    (event.target as HTMLInputElement).value = '';
  }

  useScannedValue(): void {
    if (!this.scannedValue) return;
    const v = this.scannedValue.trim();

    if (this.activeModal === 'whatsapp') {
      // wa.me/qr/XXXX = WhatsApp Business invite link — NOT a phone number
      if (v.includes('wa.me/qr/') || v.includes('whatsapp://')) {
        this.scanError = 'This QR code is a WhatsApp invite link, not a phone number.\n'
          + 'To get your WhatsApp number, go to Settings → Profile → phone number.';
        this.cdr.markForCheck();
        return;
      }
      // wa.me/15551234567 → extract digits
      const waMe = v.match(/wa\.me\/(\d+)/);
      if (waMe) {
        this.form['phone_number'] = `whatsapp:+${waMe[1]}`;
        this.modalTab = 'manual';
      } else if (/^\+?\d{7,15}$/.test(v)) {
        // Plain phone number digits
        this.form['phone_number'] = v.startsWith('+') ? `whatsapp:${v}` : `whatsapp:+${v}`;
        this.modalTab = 'manual';
      } else {
        this.scanError = 'Could not extract a phone number from this QR code. '  
          + 'Please enter your WhatsApp number manually.';
        this.cdr.markForCheck();
        return;
      }
    } else if (this.activeModal === 'telegram') {
      // Telegram bot tokens: 123456789:ABCDEFGhijk...
      if (/^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(v)) {
        this.form['bot_token'] = v;
      } else if (/^-?\d+$/.test(v)) {
        this.form['chat_id'] = v;
      } else {
        // Could be a t.me link: https://t.me/mybotname
        this.scanError = 'QR scanned. Paste the value manually into the correct field.';
        this.cdr.markForCheck();
        return;
      }
    } else {
      // Discord / Slack / Teams — treat as webhook URL
      if (v.startsWith('http')) {
        this.form['webhook_url'] = v;
      } else {
        this.scanError = 'QR value does not look like a webhook URL. Please paste it manually.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.scannedValue   = '';
    this.scanError      = '';
    this.inlineScanOpen = false;
    this.cdr.markForCheck();
  }

  // ── WhatsApp Web QR methods ─────────────────────────────────────────────────

  startWaSession(): void {
    this.waState = 'starting';
    this.waQR    = null;
    this.waError = '';
    this.stopWaPoll();
    this.cdr.markForCheck();

    this.http.post<{ ok: boolean; state: string }>('http://localhost:7979/api/whatsapp/start', {}).subscribe({
      next: () => {
        this.waState = 'starting';
        this.cdr.markForCheck();
        // Start polling for QR code
        setTimeout(() => this.pollWaStatus(), 1500);
      },
      error: (e) => {
        this.waState = 'idle';
        this.waError = e?.error?.detail || 'Could not start WhatsApp service.';
        this.cdr.markForCheck();
      }
    });
  }

  private pollWaStatus(): void {
    this.waPollTimer = setInterval(() => {
      this.http.get<{ state: string; qr: string | null }>('http://localhost:7979/api/whatsapp/status').subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            const prev = this.waState;
            this.waState = res.state as any;
            this.waQR    = res.qr ?? null;

            // Reset countdown when new QR arrives
            if (res.state === 'qr' && res.qr && res.qr !== this.waQR) {
              this.waCountdown = 60;
              this.startWaCountdown();
            }

            // Stop polling once authenticated
            if (res.state === 'authenticated') {
              this.stopWaPoll();
              // Mark as connected in integrations list
              this.loadIntegrations();
              this.showToast('WhatsApp connected via QR! ✓');
            }

            this.cdr.markForCheck();
          });
        },
        error: () => { /* ignore poll errors */ }
      });
    }, 2500);
  }

  private startWaCountdown(): void {
    clearInterval(this.waCountdownTimer);
    this.waCountdown = 60;
    this.waCountdownTimer = setInterval(() => {
      this.waCountdown--;
      if (this.waCountdown <= 0) {
        clearInterval(this.waCountdownTimer);
        // QR expired — restart to get a new one
        if (this.waState === 'qr') this.startWaSession();
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  private stopWaPoll(): void {
    clearInterval(this.waPollTimer);
    clearInterval(this.waCountdownTimer);
    this.waPollTimer      = null;
    this.waCountdownTimer = null;
  }

  logoutWa(): void {
    this.http.post('http://localhost:7979/api/whatsapp/logout', {}).subscribe({
      next: () => {
        this.waState = 'idle';
        this.waQR    = null;
        this.stopWaPoll();
        this.loadIntegrations();
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }
}
