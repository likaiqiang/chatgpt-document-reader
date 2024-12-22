class SharedInstance {
  private instances: { [key: string]: any } = {};

  setInstance<T>(key: string, instance: T): void {
    this.instances[key] = instance;
  }

  getInstance<T>(key: string): T | undefined {
    return this.instances[key];
  }

  removeInstance(key: string): void {
    delete this.instances[key];
  }
}

const sharedInstance = new SharedInstance();
export default sharedInstance;
