import * as vscode from 'vscode';
import { DebugService } from '../services/DebugService';

export function showSessionInsightsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'networkInterceptor.showSessionInsights',
    () => {
      const debugService = DebugService.getInstance();
      const insights = debugService.getSessionInsights();

      // Show insights in a more user-friendly format
      const messages = [
        `📊 Session Insights (Monorepo Debug Info)`,
        `Total Sessions: ${insights.totalSessions}`,
        `Active Sessions: ${insights.activeSessions}`,
        '',
      ];

      if (Object.keys(insights.sessionsByType).length > 0) {
        messages.push('Session Types:');
        Object.entries(insights.sessionsByType).forEach(([type, count]) => {
          messages.push(`  ${type}: ${count}`);
        });
        messages.push('');
      }

      if (insights.sessionsByScore.length > 0) {
        messages.push('Session Scores (Auto-injection threshold: 50):');
        insights.sessionsByScore.forEach((session) => {
          const icon = session.willInject ? '✅' : '❌';
          messages.push(`  ${icon} ${session.name}: ${session.score}`);
        });
        messages.push('');
      }

      if (insights.recommendations.length > 0) {
        messages.push('Recommendations:');
        insights.recommendations.forEach((rec) => {
          messages.push(`  • ${rec}`);
        });
      }

      // Show in information message and also log to console
      vscode.window.showInformationMessage(
        'Session insights logged to console'
      );
      debugService.logSessionInsights();

      // Also show in a quick pick for better UX
      const items = insights.sessionsByScore.map((session) => ({
        label: session.name,
        description: `Score: ${session.score}`,
        detail: session.willInject
          ? 'Will auto-inject'
          : 'Will not auto-inject',
      }));

      if (items.length > 0) {
        vscode.window.showQuickPick(items, {
          placeHolder: 'Debug Sessions (ordered by injection score)',
          title: 'Session Insights - Monorepo Debug',
        });
      }
    }
  );
}
