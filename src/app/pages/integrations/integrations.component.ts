// src/app/pages/integrations/integrations.component.ts
import {
  Component, OnInit, OnDestroy, ViewChild,
  ElementRef, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
