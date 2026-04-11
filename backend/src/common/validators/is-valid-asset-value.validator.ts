import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}:(?:[0-9a-fA-F]{1,4})?$/;
const CIDR_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\/(?:3[0-2]|[12]?\d)$/;

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateAssetValue(type: string, value: string): boolean {
  switch (type) {
    case 'DOMAIN':
      return DOMAIN_REGEX.test(value);
    case 'IP':
      return IPV4_REGEX.test(value) || IPV6_REGEX.test(value);
    case 'URL':
      return isValidUrl(value);
    case 'CIDR':
      return CIDR_REGEX.test(value);
    default:
      return false;
  }
}

export function IsValidAssetValue(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidAssetValue',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const type = obj['type'] as string;
          if (!type || typeof value !== 'string') {
            return false;
          }
          return validateAssetValue(type, value);
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const type = obj['type'] as string;
          const messages: Record<string, string> = {
            DOMAIN: 'Value must be a valid domain (e.g., example.com)',
            IP: 'Value must be a valid IPv4 or IPv6 address',
            URL: 'Value must be a valid URL (e.g., https://example.com)',
            CIDR: 'Value must be a valid CIDR notation (e.g., 192.168.1.0/24)',
          };
          return messages[type] || `Invalid value for asset type ${type}`;
        },
      },
    });
  };
}
