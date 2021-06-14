import redis from 'redis';

export const getRedisMethods = (options?: redis.ClientOpts) => {
  const client = redis.createClient(options);
  const setRedisValue = <T>(key: string, value: T) => new Promise((resolve, reject) => {
    client.set(key, JSON.stringify(value), (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });
  });

  const getRedisValue = <T>(key: string) => new Promise<T>((resolve, reject) => {
    client.get(key, (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result ? JSON.parse(result) : undefined);
    });
  });

  return { setRedisValue, getRedisValue };
};
