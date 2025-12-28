import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export const generateToken = (payload: object, expiresIn: string | number = '1h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as SignOptions['expiresIn'] });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
