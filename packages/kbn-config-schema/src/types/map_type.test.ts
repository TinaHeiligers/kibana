/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '../..';
import { META_FIELD_X_OAS_GET_ADDITIONAL_PROPERTIES } from '../oas_meta_fields';

test('handles object as input', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  const value = {
    name: 'foo',
  };
  const expected = new Map([['name', 'foo']]);

  expect(type.validate(value)).toEqual(expected);
});

test('properly parse the value if input is a string', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  const value = `{"name": "foo"}`;
  const expected = new Map([['name', 'foo']]);

  expect(type.validate(value)).toEqual(expected);
});

test('fails if string input cannot be parsed', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  expect(() => type.validate(`invalidjson`)).toThrowErrorMatchingInlineSnapshot(
    `"could not parse map value from json input"`
  );
});

test('fails with correct type if parsed input is not an object', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  expect(() => type.validate('[1,2,3]')).toThrowErrorMatchingInlineSnapshot(
    `"expected value of type [Map] or [object] but got [Array]"`
  );
});

test('fails when not receiving expected value type', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  const value = {
    name: 123,
  };

  expect(() => type.validate(value)).toThrowErrorMatchingInlineSnapshot(
    `"[name]: expected value of type [string] but got [number]"`
  );
});

test('fails after parsing when not receiving expected value type', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  const value = `{"name": 123}`;

  expect(() => type.validate(value)).toThrowErrorMatchingInlineSnapshot(
    `"[name]: expected value of type [string] but got [number]"`
  );
});

test('fails when not receiving expected key type', () => {
  const type = schema.mapOf(schema.number(), schema.string());
  const value = {
    name: 'foo',
  };

  expect(() => type.validate(value)).toThrowErrorMatchingInlineSnapshot(
    `"[key(\\"name\\")]: expected value of type [number] but got [string]"`
  );
});

test('fails after parsing when not receiving expected key type', () => {
  const type = schema.mapOf(schema.number(), schema.string());
  const value = `{"name": "foo"}`;

  expect(() => type.validate(value)).toThrowErrorMatchingInlineSnapshot(
    `"[key(\\"name\\")]: expected value of type [number] but got [string]"`
  );
});

test('includes namespace in failure when wrong top-level type', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  expect(() => type.validate([], {}, 'foo-namespace')).toThrowErrorMatchingInlineSnapshot(
    `"[foo-namespace]: expected value of type [Map] or [object] but got [Array]"`
  );
});

test('includes namespace in failure when wrong value type', () => {
  const type = schema.mapOf(schema.string(), schema.string());
  const value = {
    name: 123,
  };

  expect(() => type.validate(value, {}, 'foo-namespace')).toThrowErrorMatchingInlineSnapshot(
    `"[foo-namespace.name]: expected value of type [string] but got [number]"`
  );
});

test('includes namespace in failure when wrong key type', () => {
  const type = schema.mapOf(schema.number(), schema.string());
  const value = {
    name: 'foo',
  };

  expect(() => type.validate(value, {}, 'foo-namespace')).toThrowErrorMatchingInlineSnapshot(
    `"[foo-namespace.key(\\"name\\")]: expected value of type [number] but got [string]"`
  );
});

test('returns default value if undefined', () => {
  const obj = new Map([['foo', 'bar']]);

  const type = schema.mapOf(schema.string(), schema.string(), {
    defaultValue: obj,
  });

  expect(type.validate(undefined)).toEqual(obj);
});

test('mapOf within mapOf', () => {
  const type = schema.mapOf(schema.string(), schema.mapOf(schema.string(), schema.number()));
  const value = {
    foo: {
      bar: 123,
    },
  };
  const expected = new Map([['foo', new Map([['bar', 123]])]]);

  expect(type.validate(value)).toEqual(expected);
});

test('object within mapOf', () => {
  const type = schema.mapOf(
    schema.string(),
    schema.object({
      bar: schema.number(),
    })
  );
  const value = {
    foo: {
      bar: 123,
    },
  };
  const expected = new Map([['foo', { bar: 123 }]]);

  expect(type.validate(value)).toEqual(expected);
});

test('enforces required object fields within mapOf', () => {
  const type = schema.mapOf(
    schema.string(),
    schema.object({
      bar: schema.object({
        baz: schema.number(),
      }),
    })
  );
  const value = {
    foo: {},
  };

  expect(() => type.validate(value)).toThrowErrorMatchingInlineSnapshot(
    `"[foo.bar.baz]: expected value of type [number] but got [undefined]"`
  );
});

test('error preserves full path', () => {
  const type = schema.object({
    grandParentKey: schema.object({
      parentKey: schema.mapOf(schema.string({ minLength: 2 }), schema.number()),
    }),
  });

  expect(() =>
    type.validate({ grandParentKey: { parentKey: { a: 'some-value' } } })
  ).toThrowErrorMatchingInlineSnapshot(
    `"[grandParentKey.parentKey.key(\\"a\\")]: value has length [1] but it must have a minimum length of [2]."`
  );

  expect(() =>
    type.validate({ grandParentKey: { parentKey: { ab: 'some-value' } } })
  ).toThrowErrorMatchingInlineSnapshot(
    `"[grandParentKey.parentKey.ab]: expected value of type [number] but got [string]"`
  );
});

test('meta', () => {
  const stringSchema = schema.string();
  const type = schema.mapOf(schema.string(), stringSchema);
  const result = type
    .getSchema()
    .describe()
    .metas![0][META_FIELD_X_OAS_GET_ADDITIONAL_PROPERTIES]();

  expect(result).toBe(stringSchema.getSchema());
});

describe('#extendsDeep', () => {
  describe('#keyType', () => {
    const type = schema.mapOf(schema.string(), schema.object({ foo: schema.string() }));

    test('objects with unknown attributes are kept when extending with unknowns=allow', () => {
      const allowSchema = type.extendsDeep({ unknowns: 'allow' });
      const result = allowSchema.validate({ key: { foo: 'test', bar: 'test' } });
      expect(result.get('key')).toEqual({ foo: 'test', bar: 'test' });
    });

    test('objects with unknown attributes are dropped when extending with unknowns=ignore', () => {
      const ignoreSchema = type.extendsDeep({ unknowns: 'ignore' });
      const result = ignoreSchema.validate({ key: { foo: 'test', bar: 'test' } });
      expect(result.get('key')).toEqual({ foo: 'test' });
    });

    test('objects with unknown attributes fail validation when extending with unknowns=forbid', () => {
      const forbidSchema = type.extendsDeep({ unknowns: 'forbid' });
      expect(() =>
        forbidSchema.validate({ key: { foo: 'test', bar: 'test' } })
      ).toThrowErrorMatchingInlineSnapshot(`"[key.bar]: definition for this key is missing"`);
    });
  });
});
