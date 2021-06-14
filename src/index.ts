import redis from 'redis';
import express from 'express';
import moment from 'moment';
import requestIp from 'request-ip';
import { getRedisMethods } from './redis';

interface ILimiterSettings {
  delays?: number[],
  storeKey?: string,
  increaseByLimitReached?: number,
  redisOptions?: redis.ClientOpts,
  freeAttempts?: number,
  freeAttemptsUnlockDelay?: number
}

interface ILimitInfo {
  delay: number,
  attemptsLeft: number,
  nextRequestTime?: string,
  freeAttemptsUnlockTime?: string
}

interface IDelayCofig {
  index?: number,
  attemptsLeft?: number
}

export const ipLimiter = ({
  delays = [10, 20, 30, 40, 50, 60],
  storeKey = 'ipLimiter',
  increaseByLimitReached = 0,
  redisOptions = {},
  freeAttempts = 3,
  freeAttemptsUnlockDelay = 10
}: ILimiterSettings = {}) => async (request: express.Request, responce: express.Response, next: express.NextFunction) => {
  if (delays.length === 0) return next();

  const { getRedisValue, setRedisValue } = getRedisMethods(redisOptions);

  const clientIp = requestIp.getClientIp(request);

  const path = request.path.replace(/^\/+|\/+$/g, '');

  const redisKey = `${storeKey}_${path}_${clientIp}`;
  const redisDelay = await getRedisValue<ILimitInfo>(redisKey);

  const getFreeAttemptsReleaseTime = () => moment().add(freeAttemptsUnlockDelay, 'second').toISOString();

  const getDelay = ({ index = 0, attemptsLeft = freeAttempts }: IDelayCofig = {}): ILimitInfo => (attemptsLeft > 0 ? ({
    delay: 0,
    attemptsLeft: attemptsLeft - 1,
    freeAttemptsUnlockTime: getFreeAttemptsReleaseTime()
  }) : ({
    delay: delays[index],
    attemptsLeft: 0,
    nextRequestTime: moment().add(delays[index], 'second').toISOString()
  }));

  const getSecondsDiff = (isoString = moment().toISOString()) => moment(isoString).diff(moment(), 'second');

  const continueRequest = async ({
    delayConfig = {},
    redisDelayKey,
    requestObject,
    nextFunction
  }: {
    delayConfig?: IDelayCofig,
    redisDelayKey: string,
    requestObject: express.Request,
    nextFunction: express.NextFunction
  }) => {
    const requestLimitInfo = getDelay(delayConfig);
    await setRedisValue(redisDelayKey, requestLimitInfo);
    Object.assign(requestObject, { delay: requestLimitInfo });
    return nextFunction();
  };

  const stopRequest = async ({
    redisDelayKey,
    delayInfo,
    responceObject
  }: {
    redisDelayKey: string,
    delayInfo: ILimitInfo,
    responceObject: express.Response
  }) => {
    await setRedisValue(redisDelayKey, delayInfo);
    return responceObject.status(429).send(delayInfo);
  };

  if (!redisDelay) {
    return continueRequest({
      redisDelayKey: redisKey,
      requestObject: request,
      nextFunction: next
    });
  }

  if (redisDelay.attemptsLeft > 0) {
    const secondsDiff = getSecondsDiff(redisDelay.freeAttemptsUnlockTime);

    return continueRequest({
      delayConfig: secondsDiff > 0 ? { attemptsLeft: redisDelay.attemptsLeft } : {},
      redisDelayKey: redisKey,
      requestObject: request,
      nextFunction: next
    });
  }

  if (redisDelay.nextRequestTime) {
    const secondsDiff = getSecondsDiff(redisDelay.nextRequestTime);
    if (secondsDiff < 0) {
      return continueRequest({
        redisDelayKey: redisKey,
        requestObject: request,
        nextFunction: next
      });
    }
  } else {
    return continueRequest({
      delayConfig: {
        attemptsLeft: 0
      },
      redisDelayKey: redisKey,
      requestObject: request,
      nextFunction: next
    });
  }

  const index = delays.findIndex((i) => i === redisDelay.delay);
  if ((index === -1 || index === delays.length - 1) && increaseByLimitReached) {
    const delay: ILimitInfo = {
      delay: redisDelay.delay + increaseByLimitReached,
      attemptsLeft: 0,
      nextRequestTime: moment().add(redisDelay.delay + increaseByLimitReached, 'second').toISOString()
    };

    return stopRequest({
      redisDelayKey: redisKey,
      delayInfo: delay,
      responceObject: responce
    });
  }
  const delay = getDelay({ index: index === delays.length - 1 ? index : index + 1, attemptsLeft: 0 });
  return stopRequest({
    redisDelayKey: redisKey,
    delayInfo: delay,
    responceObject: responce
  });
};
