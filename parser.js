// We define a function parseExpression that takes a string as input. 
// It returns an object containing the data structure for the expression at the start of the string, 
// along with the part of the string left after parsing this expression. 
// When parsing subexpressions (the argument to an application, for example), this function can be called again, 
// yielding the argument expression as well as the text that remains. 
// This text may in turn contain more arguments or may be the closing parenthesis that ends the list of arguments.

// This is the first part of the parser
function parseExpression(program){
    program = skipSpace(program);
    let match, expr;
    if(match = /^"([^"]*)"/.exec(program)){
        expr = {type: "value", value: match[1]};
    } else if(match = /^\d+\b/.exec(program)){
        expr = {type: "value", value: Number(match[0])};
    } else if(match = /^[^\s(),#"]+/.exec(program)){
        expr = {type: "word", name: match[0]};
    } else {
        throw new SyntaxError("Unexpected syntax: " + program);
    }
    return parseApply(expr, program.slice(match[0].length));
}

// Because Wisp, like JavaScript, allows any amount of whitespace between its elements, 
// we have to repeatedly cut the whitespace off the start of the program string. 
// The skipSpace function helps with this.

function skipSpace(string){
    let first = string.search(/\S/);
    if(first == -1) return "";
    return string.slice(first);
}

// Cut off the part that was matched from the program string and pass that,
// along with the expression object, to parseApply.
// parseApply checks whether the expression is an application, if so, it parses a parenthesized list of arguments.

function parseApply(expr, program){
    program = skipSpace(program);
    if(program[0] != "("){
        return {expr: expr, rest: program};
    }

    program = skipSpace(program.slice(1));
    expr = {type: "apply", operator: expr, args: []};
    while(program[0] != ")"){
        let arg = parseExpression(program);
        expr.args.push(arg.expr);
        program = skipSpace(arg.rest);
        if(program[0] == ","){
            program = skipSpace(program.slice(1));
        }
        else if(program[0] != ")"){
            throw new SyntaxError("Expected ',' or ')'");
        }
    }
    return parseApply(expr, program.slice(1));
}

// We wrap it in a convenient parse function that verifies that it has reached the end of input string
// after parsing the expression, and that gives us the program's data structure.

function parse(program){
    let {expr, rest} = parseExpression(program);
    if(skipSpace(rest).length > 0){
        throw new SyntaxError("Unexpected text after program");
    }
    return expr;
}

// console.log(parse("+(+(5, 10), +(6, 10))"));

const specialForms = Object.create(null);

function evaluate(expr, scope){
    if(expr.type == "value"){
        return expr.value;
    }
    else if(expr.type == "word"){
        if(expr.name in scope){
            return scope[expr.name];
        }
        else{
            throw new ReferenceError(
                `Undefined binding: ${expr.name}`
            );
        }
    }
    else if(expr.type == "apply"){
        let{operator, args} = expr;
        if(operator.type == "word" && operator.name in specialForms){
            return specialForms[operator.name](expr.args, scope);
        }
        else{
            let op = evaluate(operator, scope);
            if(typeof op == "function"){
                return op(...args.map(arg => evaluate(arg, scope)));
            }
            else{
                throw new TypeError("Applying a non-function.");
            }
        }
    }
}

// Special Forms

specialForms.if = (args, scope) => {
    if(args.length != 3){
        throw new SyntaxError("Wrong number of args to if");
    }
    else if(evaluate(args[0], scope) !== false){
        return evaluate(args[1], scope);
    }
    else{
        return evaluate(args[2], scope);
    }
};

// Wisp's "if" construct expects exactly three arguments.
// It'll evaluate the first, and if the result isn't the value false, it'll evaluate the second. Otherwise the third gets evaluated.
// if - should only evaluate only either it's second or its third argument, depending on the value of the first.

specialForms.while = (args, scope) => {
    if(args.length != 2){
        throw new SyntaxError("Wrong number of args to while");
    }
    while(evaluate(args[0], scope) !== false){
        evaluate(args[1], scope);
    }
    // Since undefined does not exist in wisp, we return false. For lack of meaningful result.
    return false;
};

// do - which executes all it's arguments from top to bottom. Its value is the value produced by the last argument.
specialForms.do = (args, scope) => {
    let value = false;
    for(let arg of args){
        value = evaluate(arg, scope);
    }
    return value;
}
