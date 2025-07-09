import * as vscode from 'vscode';
import { ExtensionController } from './ExtensionController';
import { LoggerService } from './services/LoggerService';

let extensionController: ExtensionController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const logger = LoggerService.getInstance();

  try {
    logger.info('Activating Network Interceptor Extension');

    // Create and initialize the main controller
    extensionController = new ExtensionController(context);

    // Add controller to disposables so it gets cleaned up properly
    context.subscriptions.push({
      dispose: () => {
        if (extensionController) {
          extensionController.dispose();
          extensionController = undefined;
        }
      },
    });

    logger.info('Network Interceptor Extension activated successfully');

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get(
      'networkInterceptor.hasShownWelcome',
      false
    );
    if (!hasShownWelcome) {
      showWelcomeMessage(context);
    }
  } catch (error) {
    logger.error('Failed to activate extension', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window
      .showErrorMessage(
        `Failed to activate Network Interceptor: ${message}`,
        'Show Logs'
      )
      .then((action) => {
        if (action === 'Show Logs') {
          logger.show();
        }
      });
  }
}

export function deactivate(): void {
  const logger = LoggerService.getInstance();
  logger.info('Deactivating Network Interceptor Extension');

  if (extensionController) {
    extensionController.dispose();
    extensionController = undefined;
  }

  logger.info('Extension deactivated');
}

async function showWelcomeMessage(
  context: vscode.ExtensionContext
): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    'Welcome to Network Interceptor! 🌐\n\n' +
      'This extension captures HTTP/HTTPS requests during Node.js debugging sessions. ' +
      'Start debugging a Node.js application to begin monitoring network traffic.',
    'Open Panel',
    'Show Documentation',
    "Don't Show Again"
  );

  switch (action) {
    case 'Open Panel':
      await vscode.commands.executeCommand('networkInterceptor.showPanel');
      break;

    case 'Show Documentation':
      await vscode.env.openExternal(
        vscode.Uri.parse(
          'https://github.com/your-username/vscode-network-interceptor#readme'
        )
      );
      break;

    case "Don't Show Again":
      await context.globalState.update(
        'networkInterceptor.hasShownWelcome',
        true
      );
      break;
  }

  // Mark as shown regardless of action
  if (action) {
    await context.globalState.update(
      'networkInterceptor.hasShownWelcome',
      true
    );
  }
}
