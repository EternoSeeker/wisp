# Wisp

## A simple programming language that is implemented in JavaScript

### Following program binds the value 10 to the variable x, then prints "large" if x is greater than 5, and "small" otherwise
```js
do(define(x, 10),
   if(>(x, 5),
      print("large"),
      print("small")))
```

<div>
  <img src="syntax_tree.svg" height="180">
</div>

### The >(x, 5) part of the previous program would be represented like this:

```js
{
  type: "apply",
  operator: {type: "word", name: ">"},
  args: [
    {type: "word", name: "x"},
    {type: "value", value: 5}
  ]
}
```

### Computes sum of numbers 1 to 10, expressed in wisp

```js
run(`
    do(define(total, 0),
    define(count, 1),
    while(<(count, 11),
            do(define(total, +(total, count)),
                define(count, +(count, 1)))),
    print(total))
`);

// → 55
```


### Defines a function, plusOne, that adds one to its argument, and calls it
```js
run(`
    do(define(plusOne, fun(a, +(a, 1))),
    print(plusOne(10)))
`);
// -> 11
```


### Defines a function, pow, that raises its first argument to the power of the second, and calls it
```js
run(`
    do(define(pow, fun(base, exp,
        if(==(exp, 0),
            1,
            *(base, pow(base, -(exp, 1)))))),
    print(pow(2, 10)))
`);
// -> 1024
```
