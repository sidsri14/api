import { RazorpayProvider } from './RazorpayProvider.js';
import { StripeProvider } from './StripeProvider.js';
import { BaseProvider } from './BaseProvider.js';

export class ProviderFactory {
  private static instances: Map<string, BaseProvider> = new Map();

  static getProvider(providerName: string): BaseProvider {
    const name = providerName.toLowerCase();
    
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    let instance: BaseProvider;

    switch (name) {
      case 'razorpay':
        instance = new RazorpayProvider();
        break;
      case 'stripe':
        instance = new StripeProvider();
        break;
      default:
        throw new Error(`Unsupported payment provider: ${providerName}`);
    }

    this.instances.set(name, instance);
    return instance;
  }
}
