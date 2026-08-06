import { Request } from 'express';
import { v4 } from 'uuid';

export const isEmpty = (value: string | number | object): boolean => {
  if (value === null) {
    return true;
  } else if (typeof value !== 'number' && value === '') {
    return true;
  } else if (typeof value === 'undefined' || value === undefined) {
    return true;
  } else if (value !== null && typeof value === 'object' && !Object.keys(value).length) {
    return true;
  } else {
    return false;
  }
};

export const safeFileName = (input: string) => {
  return input.replace(/[^a-z0-9]/gi, '-');
};

export const padRight = (input: string, length: number) => {
  if (input.length >= length) {
    return input;
  }

  while (input.length < length) {
    input += ' ';
  }
  return input;
};

export const buildAbsoluteUrl = (req: Request, relativePath: string) => {
  let protocol = 'https://',
    port = '';
  if (req.hostname === 'localhost') {
    protocol = 'http://';
    port = process.env.PORT ? `:${process.env.PORT}` : ':3000';
  }

  return new URL(relativePath, `${protocol}${req.hostname}${port}`).toString();
};

export const isValidEmail = (email: string) => {
  return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
    email,
  );
};

export const uuid = v4;
