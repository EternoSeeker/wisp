// We define a function parseExpression that takes a string as input.
// It returns an object containing the data structure for the expression at the start of the string,
// along with the part of the string left after parsing this expression.
// When parsing subexpressions (the argument to an application, for example), this function can be called again,
// yielding the argument expression as well as the text that remains.
// This text may in turn contain more arguments or may be the closing parenthesis that ends the list of arguments.

// This is the first part of the parser
function parseExpression(program) {
  program = skipSpace(program);
  let match, expr;
  if ((match = /^"([^"]*)"/.exec(program))) {
    expr = { type: "value", value: match[1] };
  } else if ((match = /^\d+\b/.exec(program))) {
    expr = { type: "value", value: Number(match[0]) };
  } else if ((match = /^[^\s(),#"]+/.exec(program))) {
    expr = { type: "word", name: match[0] };
  } else {
    throw new SyntaxError("Unexpected syntax: " + program);
  }
  return parseApply(expr, program.slice(match[0].length));
}

// Because Wisp, like JavaScript, allows any amount of whitespace between its elements,
// we have to repeatedly cut the whitespace off the start of the program string.
// The skipSpace function helps with this.

function skipSpace(string) {
  // Regular expression to match whitespace and comments (starting with #)
  let match = string.match(/(\s|#.*)*/);
  if(match){
    return string.slice(match[0].length);
  }
  return "";
}

// Cut off the part that was matched from the program string and pass that,
// along with the expression object, to parseApply.
// parseApply checks whether the expression is an application, if so, it parses a parenthesized list of arguments.

function parseApply(expr, program) {
  program = skipSpace(program);
  if (program[0] != "(") {
    return { expr: expr, rest: program };
  }

  program = skipSpace(program.slice(1));
  expr = { type: "apply", operator: expr, args: [] };
  while (program[0] != ")") {
    let arg = parseExpression(program);
    expr.args.push(arg.expr);
    program = skipSpace(arg.rest);
    if (program[0] == ",") {
      program = skipSpace(program.slice(1));
    } else if (program[0] != ")") {
      throw new SyntaxError("Expected ',' or ')'");
    }
  }
  return parseApply(expr, program.slice(1));
}

// We wrap it in a convenient parse function that verifies that it has reached the end of input string
// after parsing the expression, and that gives us the program's data structure.

function parse(program) {
  let { expr, rest } = parseExpression(program);
  if (skipSpace(rest).length > 0) {
    throw new SyntaxError("Unexpected text after program");
  }
  return expr;
}

// console.log(parse("+(+(5, 10), +(6, 10))"));

const specialForms = Object.create(null);

function evaluate(expr, scope) {
  if (expr.type == "value") {
    return expr.value;
  } else if (expr.type == "word") {
    if (expr.name in scope) {
      return scope[expr.name];
    } else {
      throw new ReferenceError(`Undefined binding: ${expr.name}`);
    }
  } else if (expr.type == "apply") {
    let { operator, args } = expr;
    if (operator.type == "word" && operator.name in specialForms) {
      return specialForms[operator.name](expr.args, scope);
    } else {
      let op = evaluate(operator, scope);
      if (typeof op == "function") {
        return op(...args.map((arg) => evaluate(arg, scope)));
      } else {
        throw new TypeError("Applying a non-function.");
      }
    }
  }
}

// Special Forms

specialForms.if = (args, scope) => {
  if (args.length != 3) {
    throw new SyntaxError("Wrong number of args to if");
  } else if (evaluate(args[0], scope) !== false) {
    return evaluate(args[1], scope);
  } else {
    return evaluate(args[2], scope);
  }
};

// Wisp's "if" construct expects exactly three arguments.
// It'll evaluate the first, and if the result isn't the value false, it'll evaluate the second. Otherwise the third gets evaluated.
// if - should only evaluate only either it's second or its third argument, depending on the value of the first.

specialForms.while = (args, scope) => {
  if (args.length != 2) {
    throw new SyntaxError("Wrong number of args to while");
  }
  while (evaluate(args[0], scope) !== false) {
    evaluate(args[1], scope);
  }
  // Since undefined does not exist in wisp, we return false. For lack of meaningful result.
  return false;
};

// do - which executes all it's arguments from top to bottom. Its value is the value produced by the last argument.
specialForms.do = (args, scope) => {
  let value = false;
  for (let arg of args) {
    value = evaluate(arg, scope);
  }
  return value;
};

// define - to create bindings and give them new values
// expects a word as its first argument and an expression producing the value to assign to that word as its second argument.
// since define like everything, is an expression, it must return a value.

specialForms.define = (args, scope) => {
  if (args.length != 2 || args[0].type != "word") {
    throw new SyntaxError("Incorrect use of define");
  }
  let value = evaluate(args[1], scope);
  scope[args[0].name] = value;
  return value;
};

// The Environment

// The scope accepted by evaluate is an object with properties whose names correspond to binding names
// and whose values correspond to the values those bindings are bound to.

// Let's define an object to represent the global scope

const topScope = Object.create(null);

topScope.true = true;
topScope.false = false;

// We can now evaluate a simple expression that negates a boolean value.

// let prog = parse(`if(true, false, true)`);
// console.log(evaluate(prog, topScope));

// To supply basic arithmetic and comparison operators, we will also add some function values to the scope

for (let op of ["+", "-", "*", "/", "==", "<", ">"]) {
  topScope[op] = Function("a, b", `return a ${op} b;`);
}

// Useful to have a way to output values, so we'll wrap console.log in a function and call it print.

topScope.print = (value) => {
  console.log(value);
  return value;
};

// The following function provides a convenient way to parse a program and run it in a fresh scope:

function run(program) {
  return evaluate(parse(program), Object.create(topScope));
}

// We'll use object prototype chains to represent nested scopes so that the program can add bindings to its local scope without changing top level scope.

// Computes sum of numbers 1 to 10, expressed in wisp
// run(`
//     do(define(total, 0),
//     define(count, 1),
//     while(<(count, 11),
//             do(define(total, +(total, count)),
//                 define(count, +(count, 1)))),
//     print(total))
// `);

// -> 55

// Functions

// add 'fun' construct, which treats its last argument as the function's body and
// uses all arguments before that as the names of the function's parameters.

specialForms.fun = (args, scope) => {
  if (!args.length) {
    throw new SyntaxError("Functions need a body");
  }
  let body = args[args.length - 1];
  let params = args.slice(0, args.length - 1).map((expr) => {
    if (expr.type != "word") {
      throw new SyntaxError("Parameters names must be words");
    }
    return expr.name;
  });

  return function (...args) {
    if (args.length != params.length) {
      throw new TypeError("Wrong number of arguments");
    }
    let localScope = Object.create(scope);
    for (let i = 0; i < args.length; i++) {
      localScope[params[i]] = args[i];
    }
    return evaluate(body, localScope);
  };
};

// functions in wisp get their own local scope.
// function produced by the fun form creates this local scope and adds the argument bindings to it.
// it then evaluates the function body in this scope and returns the result.

run(`
    do(define(plusOne, fun(a, +(a, 1))),
    print(plusOne(10)))
`);

run(`
    do(define(pow, fun(base, exp,
        if(==(exp, 0),
            1,
            *(base, pow(base, -(exp, 1)))))),
    print(pow(2, 10)))
`);

// What we have built is an interpreter.
// During evaluation, it acts directly on the representation of the program produced by the parser.

// Compilation is the process of adding another step between parsing and the running of the program
// which transforms the program into something that can be evaluated more efficiently by doing as much work possible in advance.

// Any process that converts a program to a different representation can be thought of as compilation.

// Alternative evaluation strategy -
// first convert the program into javascript program
// use Function to invoke JavaScript compiler on it and runs the result
// It'll make wisp run very fast while still being quite simple to implement.

// ARRAYS

// Add support for arrays to Wisp by adding the following three functions to the top scope:
// array(...values) to construct an array containing the argument values,
// length(array) to get an array’s length, and
// element(array, n) to fetch the nth element from an array.

topScope.array = (...values) => {
  return values;
};

topScope.length = (array) => {
  if (!Array.isArray(array)) {
    throw new TypeError("Argument to length must be an array");
  }
  return array.length;
};

topScope.element = (array, n) => {
  if (!Array.isArray(array)) {
    throw new TypeError("First argument to element must be an array");
  }
  if (typeof n !== "number") {
    throw new TypeError("Second argument to element must be a number");
  }
  return array[n];
};

run(`
    do(define(sum, fun(array,
         do(define(i, 0),
            define(sum, 0),
            while(<(i, length(array)),
              do(define(sum, +(sum, element(array, i))),
                 define(i, +(i, 1)))),
            sum))),
       print(sum(array(1, 2, 3))))
`);


// The way we have defined fun allows functions in Wisp to reference the surrounding scope, 
// allowing the function’s body to use local values that were visible at the time the function was defined, 
// just like JavaScript functions do.

run(`
    do(define(f, fun(a, fun(b, +(a, b)))),
       print(f(4)(5)))
`);

console.log(parse("# hello\nx"));
// → {type: "word", name: "x"}

console.log(parse("a # one\n   # two\n()"));
// → {type: "apply",
//    operator: {type: "word", name: "a"},
//    args: []}