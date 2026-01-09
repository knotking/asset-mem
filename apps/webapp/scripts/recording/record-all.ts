import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

async function runScript(scriptName: string): Promise<boolean> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎬 Running: ${scriptName}`);
  console.log('═'.repeat(60));
  
  try {
    const scriptPath = path.join(__dirname, scriptName);
    const { stdout, stderr } = await execAsync(`tsx "${scriptPath}"`, {
      cwd: path.join(__dirname, '../..'),
    });
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr) {
      console.error(stderr);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to run ${scriptName}:`, error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

async function main() {
  console.log('🎬 Starting Full Recording (Webapp + Mobile)');
  console.log('═══════════════════════════════════════\n');
  
  const scripts = [
    'record-webapp.ts',
    'record-mobile.ts',
  ];
  
  const results: Array<{ script: string; success: boolean }> = [];
  
  for (const script of scripts) {
    const success = await runScript(script);
    results.push({ script, success });
    
    // Wait between recordings
    if (scripts.indexOf(script) < scripts.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next recording...\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  
  // Print final summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Final Summary');
  console.log('═══════════════════════════════════════');
  
  for (const { script, success } of results) {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${script}`);
  }
  
  const allSuccess = results.every((r) => r.success);
  
  if (allSuccess) {
    console.log('\n✅ All recordings completed successfully!');
    console.log('📹 Check the recordings directory for output files.');
  } else {
    console.log('\n⚠️  Some recordings had issues. Check the logs above.');
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

