# Documentation

### Description
Middleware for limiting requests by route. It's designed for ExpressJS and uses Redis as storage.

### Installation
```
npm install --save @justpsst/iprequestlimitter
```
### Usage
```javascript
import { ipLimitter } from '@justpsst/iprequestlimitter';

router.get('/', ipLimitter(config), (request, response) => {...});
```

### Config interface

Property | Type | Default | Description
------------ | ------------- | ------------- | -------------
delays | number[], optional | [10, 20, 30, 40, 50, 60] | Delay between requests in seconds. In case when request comes before delay timer expires, delay timer would be increased (10 > 20 > 30 ...)
storeKey | string, optional | "ipLimitter" | Key for redis to identify request. In redis it would be stored like `${storeKey}_${path}_${clientIp}` 
increaseByLimitReached | number, optional | 0 | Number of seconds, which would be added to delay timer in case when 'delays' array reaches it's limit
redisOptions | redis.ClientOpts, optional | {} | Redis options described here: https://www.npmjs.com/package/redis
freeAttempts | number, optional | 0 | Number of free attempts, when delay timer won't be used
freeAttemptsUnlockDelay | number, optional | 0 | Number of seconds, which is needed to refresh attemptsLeft

### Behavior
When a request comes to a server, middleware checks free attempts left. Middleware modifies request object when free attempts are greater than 0 or delay timer is expired/not set up.
```javascript
Object.assign(request, { delay: requestLimitInfo });
```
#### requestLimitInfo interface
Property | Type | Description
------------ | ------------- | -------------
delay | number | Delay until next request in seconds
attemptsLeft | number | Free attempts left. Delay timer will be 0 in case when attemptsLeft is greater than 0
nextRequestTime | string, optional | Time in ISO string format. It describes the time when the delay timer will be refreshed. In case when request comes before delay timer expires, delay timer would be increased (10 > 20 > 30 ...)
freeAttemptsUnlockTime | string, optional | Time in ISO string format. It describes the time when the freeAttempts will be refreshed. In case when request comes before unlock timer releases, free attempts would be decreased by 1

```javascript
{
  delay: number,
  attemptsLeft: number,
  nextRequestTime?: string,
  freeAttemptsUnlockTime?: string
}
```

In case when delay timer is not expired, the server will return the error code '429' with the response object.

```javascript
return responce.status(429).send(requestLimitInfo);
```