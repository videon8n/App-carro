# App-carro - Instalador automatico para Windows
# ================================================
#
# Uso: abra o PowerShell e rode:
#   irm https://raw.githubusercontent.com/videon8n/App-carro/main/install-windows.ps1 | iex
#
# O que ele faz:
#   1. Eleva pra Admin automaticamente (pede UAC)
#   2. Checa/instala Node.js LTS via winget
#   3. Checa/instala Git via winget
#   4. Clona (ou atualiza) o repo em %USERPROFILE%\App-carro
#   5. Roda `npm run setup` (instala deps, cria .env)
#   6. Inicia o server em modo dev numa nova janela
#   7. Espera o server responder e abre http://localhost:3000 no navegador
#
# Requisitos: Windows 10 (1809+) ou Windows 11 com winget.

$ErrorActionPreference = 'Stop'

# ---------- helpers de log ----------

function Write-Step($text)  { Write-Host "`n==> $text"    -ForegroundColor Cyan }
function Write-Ok($text)    { Write-Host "  [OK] $text"   -ForegroundColor Green }
function Write-Warn($text)  { Write-Host "  [!]  $text"   -ForegroundColor Yellow }
function Write-Err($text)   { Write-Host "  [ERRO] $text" -ForegroundColor Red }

function Refresh-Path {
    # winget installs nao refrescam o PATH da sessao atual.
    # Esta funcao remonta o PATH a partir das variaveis do registro.
    $machine = [System.Environment]::GetEnvironmentVariable("Path","Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path","User")
    $env:Path = "$machine;$user"
}

# ---------- 1. Auto-elevacao ----------

$principal = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warn "Este script precisa de privilegios de Administrador."
    Write-Host "Solicitando elevacao (vai abrir um popup UAC)..."
    if ($PSCommandPath) {
        Start-Process powershell -Verb RunAs -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-NoProfile",
            "-File", $PSCommandPath
        )
    } else {
        # Script rodado via `irm | iex` (sem arquivo fisico)
        Start-Process powershell -Verb RunAs -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-NoProfile",
            "-Command", "irm https://raw.githubusercontent.com/videon8n/App-carro/main/install-windows.ps1 | iex"
        )
    }
    exit
}

# ---------- Banner ----------

Clear-Host
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  App-carro - Instalador Windows" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vou instalar Node.js, Git, baixar o projeto e iniciar o server."
Write-Host "Tempo estimado: 3 a 5 minutos (depende da sua internet)."
Write-Host ""

# Best-effort: ajustar ExecutionPolicy no escopo do usuario pra evitar
# problemas com npm.ps1 em sessoes futuras. Se falhar (group policy
# restrita), tudo bem — o script usa `cmd /c` pra contornar mesmo assim.
try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction SilentlyContinue
} catch {
    # ignorar — group policy pode estar forcando Restricted
}

# ---------- 2. Checar winget ----------

Write-Step "Verificando winget (Windows Package Manager)"
try {
    $wingetVersion = & winget --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "winget retornou erro" }
    Write-Ok "winget $wingetVersion"
} catch {
    Write-Err "winget nao encontrado!"
    Write-Host ""
    Write-Host "O Windows Package Manager e necessario pra instalar Node e Git automaticamente."
    Write-Host "Instale o 'App Installer' pela Microsoft Store:"
    Write-Host "  https://aka.ms/getwinget" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Depois rode este script de novo."
    Write-Host ""
    Read-Host "Pressione Enter para fechar"
    exit 1
}

# ---------- 3. Instalar Node.js ----------

Write-Step "Verificando Node.js"
$needNode = $true
try {
    $nodeVersion = & node -v 2>&1
    if ($LASTEXITCODE -eq 0 -and $nodeVersion -match "v(\d+)\.") {
        $major = [int]$Matches[1]
        if ($major -ge 20) {
            Write-Ok "Node $nodeVersion ja instalado"
            $needNode = $false
        } else {
            Write-Warn "Node $nodeVersion instalado, mas precisa de v20+. Vou atualizar."
        }
    }
} catch {
    # Node nao esta no PATH
}

if ($needNode) {
    Write-Host "  Instalando Node.js LTS (pode levar 1-2 min)..."
    & winget install --id OpenJS.NodeJS.LTS `
        --silent `
        --accept-source-agreements `
        --accept-package-agreements `
        --source winget
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falha ao instalar Node.js via winget. Codigo: $LASTEXITCODE"
        Write-Host "Tente instalar manualmente: https://nodejs.org"
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
    Refresh-Path
    Write-Ok "Node.js instalado"
}

# ---------- 4. Instalar Git ----------

Write-Step "Verificando Git"
$needGit = $true
try {
    $gitVersion = & git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "$gitVersion ja instalado"
        $needGit = $false
    }
} catch {
    # Git nao esta no PATH
}

if ($needGit) {
    Write-Host "  Instalando Git..."
    & winget install --id Git.Git `
        --silent `
        --accept-source-agreements `
        --accept-package-agreements `
        --source winget
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falha ao instalar Git via winget. Codigo: $LASTEXITCODE"
        Write-Host "Tente instalar manualmente: https://git-scm.com"
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
    Refresh-Path
    Write-Ok "Git instalado"
}

# ---------- 5. Clonar ou atualizar o repo ----------

Write-Step "Preparando o projeto"
$repoPath = Join-Path $env:USERPROFILE "App-carro"

if (Test-Path $repoPath) {
    Write-Host "  Pasta ja existe em $repoPath"
    Write-Host "  Fazendo git pull..."
    Set-Location $repoPath
    & git pull origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "git pull falhou (talvez conflito local) - continuando mesmo assim"
    } else {
        Write-Ok "Repositorio atualizado"
    }
} else {
    Write-Host "  Clonando em $repoPath..."
    & git clone https://github.com/videon8n/App-carro $repoPath
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git clone falhou. Verifique sua conexao."
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
    Set-Location $repoPath
    Write-Ok "Repositorio clonado"
}

# ---------- 6. Rodar setup do projeto ----------

Write-Step "Instalando dependencias do projeto (npm run setup)"
Write-Host "  Isto vai rodar npm install - 1 a 2 minutos na primeira vez..."
# Usamos 'cmd /c npm ...' em vez de '& npm ...' pra contornar uma
# limitacao: PowerShell tenta carregar npm.ps1 que e bloqueado pela
# ExecutionPolicy em muitas maquinas Windows. cmd.exe usa npm.cmd, que
# nao sofre dessa restricao.
cmd /c "npm run setup"
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm run setup falhou. Veja o erro acima."
    Write-Host ""
    Write-Host "Causas comuns:"
    Write-Host "  - Antivirus bloqueando npm (adicione a pasta $repoPath a whitelist)"
    Write-Host "  - Falta de build tools (o Node installer ja tinha que ter instalado)"
    Write-Host "  - Conexao lenta/caiu"
    Write-Host ""
    Write-Host "Tente rodar manualmente: cd $repoPath && cmd /c `"npm install`""
    Read-Host "Pressione Enter para fechar"
    exit 1
}
Write-Ok "Setup completo"

# ---------- 7. Iniciar o server em uma nova janela ----------

Write-Step "Iniciando o servidor"
# Usamos cmd.exe (nao powershell) pra janela do server, pelos mesmos
# motivos da Step 6: evita a limitacao do npm.ps1. /K mantem a janela
# aberta, titulo e cd sao feitos no mesmo chain.
$serverCmdLine = "title App-carro - dev server && cd /d `"$repoPath`" && echo. && echo ============================================== && echo   App-carro - servidor de desenvolvimento && echo   NAO FECHE ESSA JANELA enquanto estiver usando && echo   Pra parar: Ctrl+C && echo ============================================== && echo. && npm run dev"
Start-Process cmd -ArgumentList @("/K", $serverCmdLine)
Write-Ok "Servidor iniciando numa nova janela"

# ---------- 8. Esperar o server responder e abrir navegador ----------

Write-Step "Esperando o servidor ficar pronto..."
$maxWait = 30
$waited = 0
$serverReady = $false
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/health" `
            -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            $serverReady = $true
            break
        }
    } catch {
        # server ainda subindo
    }
}

if ($serverReady) {
    Write-Ok "Servidor respondendo em http://localhost:3000"
} else {
    Write-Warn "Servidor nao respondeu em $maxWait segundos. Vou abrir o navegador mesmo assim."
}

Write-Step "Abrindo o navegador"
Start-Process "http://localhost:3000"
Write-Ok "Navegador aberto"

# ---------- 9. Mensagem final ----------

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Instalacao completa!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "O App-carro esta rodando em: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Blue
Write-Host ""
Write-Host "Modo DEMO esta ligado (8 carros ficticios)."
Write-Host ""
Write-Host "Pra usar dados reais (scraping + IA):"
Write-Host "  1. Abra $repoPath\.env" -ForegroundColor Gray
Write-Host "  2. Troque DEMO_MODE=true por DEMO_MODE=false" -ForegroundColor Gray
Write-Host "  3. Preencha ANTHROPIC_API_KEY=sk-ant-..." -ForegroundColor Gray
Write-Host "  4. O server reinicia sozinho (node --watch)" -ForegroundColor Gray
Write-Host ""
Write-Host "Pra atualizar o app no futuro (quando eu fizer commits):"
Write-Host "  cd $repoPath" -ForegroundColor Gray
Write-Host "  cmd /c `"npm run sync`"" -ForegroundColor Gray
Write-Host "  (o 'cmd /c' contorna o bloqueio de npm.ps1 do PowerShell)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "A janela do servidor continua aberta em segundo plano."
Write-Host "Pra parar, feche aquela janela (ou Ctrl+C dentro dela)."
Write-Host ""
Read-Host "Pressione Enter para fechar esta janela do instalador"
