$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCli = Join-Path $taskRoot 'node_modules/supabase/dist/supabase.js'
$taskNode = (Get-Command node).Source
$taskDirectory = Join-Path $taskRoot '.tmp-campaign-queue-qa'
New-Item -ItemType Directory -Path $taskDirectory -Force | Out-Null
$taskSetup = @'
DO $$ DECLARE owner uuid:='f8d2218d-621f-4572-bf91-1c8de4df6ecd'; brand uuid; account uuid; plan uuid; BEGIN
 IF EXISTS(SELECT 1 FROM sv_content_campaigns WHERE status='active') THEN RAISE EXCEPTION 'Run concurrency QA before real plans are activated'; END IF;
 SELECT brand_id,id INTO brand,account FROM sv_connected_accounts WHERE user_id=owner AND platform='linkedin_page' AND is_active AND brand_id IS NOT NULL LIMIT 1;
 plan:=sv_create_campaign(owner,brand,'Codex queue concurrency QA','Temporary isolated queue-lock test; no AI or social provider is called.',jsonb_build_object('timezone','UTC'),ARRAY[account],false,false,1,ARRAY[now()+interval '2 days',now()+interval '3 days'],'ce3d59a1-f18c-44fa-9130-ae6385f135e3');
 UPDATE sv_content_campaigns SET status='active' WHERE id=plan;
END $$;
'@
$taskHolder = @'
BEGIN;
DO $$ DECLARE item sv_campaign_items; BEGIN
 SELECT * INTO item FROM sv_claim_campaign_item();
 IF item.id IS NULL THEN RAISE EXCEPTION 'First worker did not claim a slot'; END IF;
 PERFORM pg_advisory_xact_lock(31415926);
 PERFORM pg_sleep(45);
END $$;
ROLLBACK;
'@
$taskContender = @'
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=31415926 AND granted) THEN RAISE EXCEPTION 'First worker lock was not held; test is inconclusive'; END IF;
 IF EXISTS(SELECT 1 FROM sv_claim_campaign_item()) THEN RAISE EXCEPTION 'Second worker bypassed the locked plan'; END IF;
END $$;
ROLLBACK;
SELECT 'Concurrent worker respected the locked plan and daily reservation' AS result;
'@
$taskCleanup = @'
DELETE FROM public.sv_content_campaigns c
WHERE c.request_key='ce3d59a1-f18c-44fa-9130-ae6385f135e3' AND c.name='Codex queue concurrency QA' AND c.user_id='f8d2218d-621f-4572-bf91-1c8de4df6ecd'
AND NOT EXISTS(SELECT 1 FROM sv_campaign_items i WHERE i.campaign_id=c.id AND i.post_id IS NOT NULL);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM sv_content_campaigns WHERE request_key='ce3d59a1-f18c-44fa-9130-ae6385f135e3') THEN RAISE EXCEPTION 'Temporary QA plan could not be removed'; END IF; END $$;
SELECT count(*) AS remaining_qa_plans FROM sv_content_campaigns WHERE request_key='ce3d59a1-f18c-44fa-9130-ae6385f135e3';
'@
$taskFiles = @{}
foreach ($taskEntry in @{setup=$taskSetup;holder=$taskHolder;contender=$taskContender;cleanup=$taskCleanup}.GetEnumerator()) {
 $taskPath=Join-Path $taskDirectory ($taskEntry.Key+'.sql')
 [System.IO.File]::WriteAllText($taskPath,$taskEntry.Value)
 $taskFiles[$taskEntry.Key]=$taskPath
}
$taskProcess=$null
try {
 & $taskNode $taskCli db query --linked --file $taskFiles.setup
 if ($LASTEXITCODE -ne 0) { throw 'Queue QA setup failed' }
 $taskOutput=Join-Path $taskDirectory 'holder.out'
 $taskErrors=Join-Path $taskDirectory 'holder.err'
 $taskArguments=@(('"'+$taskCli+'"'),'db','query','--linked','--file',('"'+$taskFiles.holder+'"'))
 $taskProcess=Start-Process -FilePath $taskNode -ArgumentList $taskArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskOutput -RedirectStandardError $taskErrors
 $null=$taskProcess.Handle
 Start-Sleep -Seconds 12
 & $taskNode $taskCli db query --linked --file $taskFiles.contender
 if ($LASTEXITCODE -ne 0) { throw 'Concurrent claim check failed or was inconclusive' }
 $taskProcess.WaitForExit()
 $taskProcess.Refresh()
 $taskResult=Get-Content -LiteralPath $taskOutput -Raw | ConvertFrom-Json
 if (($null -ne $taskProcess.ExitCode -and $taskProcess.ExitCode -ne 0) -or -not $taskResult.PSObject.Properties['rows']) { Get-Content -LiteralPath $taskErrors; throw 'First queue worker failed' }
 Write-Output 'Concurrent queue check passed. No AI generation or publishing was performed.'
} finally {
 if ($taskProcess -and -not $taskProcess.HasExited) { $taskProcess.WaitForExit() }
 & $taskNode $taskCli db query --linked --file $taskFiles.cleanup
 if ($LASTEXITCODE -ne 0) { throw 'QA cleanup needs attention before enabling cron' }
}
