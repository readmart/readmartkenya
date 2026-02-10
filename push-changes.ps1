<#
.SYNOPSIS
    Automates the Git workflow: stage, commit, and push.

.DESCRIPTION
    Stages all changes, commits with a timestamp and description, and pushes to a remote branch.
    Includes validation for Git repository status, remote accessibility, and tracking.

.PARAMETER Description
    A brief description of the changes to include in the commit message.

.PARAMETER Remote
    The remote repository name (default: 'origin').

.PARAMETER Branch
    The branch to push to (default: 'main').

.EXAMPLE
    .\push-changes.ps1 -Description "Implemented analytics tracking"
#>

param (
    [Parameter(Mandatory=$false)]
    [string]$Description = "Automated commit",

    [Parameter(Mandatory=$false)]
    [string]$Remote = "origin",

    [Parameter(Mandatory=$false)]
    [string]$Branch = "main"
)

function Write-Success {
    param([string]$Message)
    Write-Host "`n[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "`n[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "`n[INFO] $Message" -ForegroundColor Cyan
}

try {
    # 1. Verify Git repository status
    if (!(Test-Path .git)) {
        if ((git rev-parse --is-inside-work-tree 2>$null) -ne "true") {
            Write-Error "Not a git repository (or any of the parent directories)."
            exit 1
        }
    }

    Write-Info "Checking Git repository status..."

    # 2. Check for uncommitted changes
    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Info "No changes to commit. Everything is up to date."
        exit 0
    }

    # 3. Validate remote repository accessibility
    Write-Info "Validating remote '$Remote' accessibility..."
    git remote show $Remote > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Remote '$Remote' is not accessible or does not exist."
        exit 1
    }

    # 4. Check if local branch is tracking a remote branch
    $currentBranch = git rev-parse --abbrev-ref HEAD
    $trackingBranch = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Local branch '$currentBranch' is not tracking a remote branch. Setting upstream to $Remote/$Branch..."
        $setUpstream = $true
    } else {
        Write-Success "Branch '$currentBranch' is tracking '$trackingBranch'."
        $setUpstream = $false
    }

    # 5. Stage all changes
    Write-Info "Staging all changes..."
    git add .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to stage changes."
        exit 1
    }

    # 6. Commit changes with timestamp and description
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "[$timestamp] $Description"
    Write-Info "Committing changes with message: '$commitMessage'..."
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to commit changes."
        exit 1
    }

    # 7. Push changes
    Write-Info "Pushing changes to $Remote $Branch..."
    if ($setUpstream) {
        git push -u $Remote $Branch
    } else {
        git push $Remote $Branch
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to push changes to $Remote $Branch."
        exit 1
    }

    Write-Success "Changes successfully pushed to $Remote $Branch."

    # 8. Generate Summary Report
    Write-Host "`n" + ("=" * 50) -ForegroundColor Yellow
    Write-Host "GIT PUSH SUMMARY REPORT" -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Yellow
    
    $lastCommitHash = git rev-parse HEAD
    $stats = git show --stat --oneline $lastCommitHash | Select-Object -Skip 1
    
    foreach ($line in $stats) {
        Write-Host $line
    }
    
    Write-Host ("=" * 50) -ForegroundColor Yellow

} catch {
    Write-Error "An unexpected error occurred: $_"
    exit 1
}
