import jwt, { SignOptions } from 'jsonwebtoken';
import { appEnv } from '../config/env';

export const generateToken = (payload: object, expiresIn: string | number = '1h') => {
  return jwt.sign(payload, appEnv.JWT_SECRET, { expiresIn: expiresIn as SignOptions['expiresIn'] });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, appEnv.JWT_SECRET);
  } catch (error) {
    return null;
  }
};
