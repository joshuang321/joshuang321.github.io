class Expression
{
    constructor(op, lh_expr, rh_expr)
    {
        this.op =op;
        this.lh =lh_expr;
        this.rh =rh_expr;
    }
    
    get_value(expr_values, expr)
    {
        var result =null;
        if (typeof(expr) =='object')
            result =expr.evaluate(expr_values);
        else if (typeof(expr) =='string') {
            if (expr_values.has(expr)) 
                result =expr_values.get(expr);
        }
        else if (typeof(expr) =='number')
            result =expr;
        return result;
    }
    
    evaluate(expr_values)
    {
        var lh =this.get_value(expr_values, this.lh);
        var rh =this.get_value(expr_values, this.rh);
        if (lh==null || rh ==null)
            return null;
        else {
            switch (this.op) {
                case '/': return lh/rh;
                case '*': return lh*rh;
                case '+': return lh+rh;
                case '-': return lh-rh;
                case '**': return Math.pow(lh, rh);
                default: return null;
            }
        }
    }
}
class Unit
{
    constructor(lh_expr, rh_expr, str_exprs)
    {
        this.lh =lh_expr;
        this.rh =rh_expr;
        this.expr_lookup =str_exprs;
    }
}
class Token
{
    constructor(type, value)
    {
        this.type =type;
        this.value =value;
    }

    static empty()
    {
        return new Token(null, null);
    }
    is_invalid()
    {
        return this.type==null;
    }
}
class Calculator
{
    constructor(units)
    {
        this.units =units;
        this.cursor =-1;
        this.symbols =["<=>", "**", ";", "*", "/", "+", "-", '=', '(', ')', ',', '='];
        this.op_pred = { '**' : 4, '/' : 3, '*': 3,  '+' : 2, '-' : 2, ',' : 0, '=' : 1};
        this.cur_op_pred =0;
        this.keywords =['convert', 'list', 'eval', 'where', 'store', 'help'];
        this.statement =null;
        this.parsed_str_expr =[];
        this.error =[];
        this.content_node =null;
        this.message ="";
    }

    document_init()
    {
        this.content_node =document.getElementById('content_view');
        this.append_help();
    }

    flush()
    {
        var p= document.createElement("p");
        p.innerHTML =this.message;
        p.style.fontStyle ='italic';
        this.content_node.insertBefore(p, this.content_node.firstChild);
        this.message ="";
    }

    append_help()
    {
        this.append_output('Command List');
        this.append_output('---------------------------------');
        this.append_output('Plugs the formula for a unit.');
        this.append_output('1. convert $unit where $arg1 = $expr1, $arg2 = $expr2, ...');
        this.append_output('List all the stored units.');
        this.append_output('2. list');
        this.append_output('Evaluates the expression.')
        this.append_output('3. eval $expr')
        this.append_output('Parses and store the unit');
        this.append_output('4. store $unit = $expr');
        this.append_output('5. help');
        this.flush();
    }

    append_output(message)
    {
        this.message += '<br>' + message;

    }

    get_expression()
    {
        var tok =this.get_token();
        var lh_expr =null;
        if (tok.type=='expression') {
            lh_expr = tok.value;
            if (typeof(lh_expr) =='string' && !this.parsed_str_expr.includes(lh_expr)) 
                this.parsed_str_expr.push(lh_expr);
        }
        else if (tok.type=='symbol' && tok.value =='(') {
            lh_expr =this.get_expression();
            this.get_token();
        }
        else
            return lh_expr;

        tok =this.peek_token();
        while (!tok.is_invalid() && !(tok.type=='symbol' && tok.value==';')) {
            var op =tok.value;
            var op_pred = this.op_pred[op];
            this.cur_op_pred =op_pred;
            
            if (this.cur_op_pred>op_pred)
                break;
            this.get_token();
            var rh_expr =this.get_expression();
            lh_expr = new Expression(op, lh_expr, rh_expr);

            tok =this.peek_token();
        }
        return lh_expr;
    }
    
    get_actual_expression()
    {
        this.cur_op_pred =0;
        return this.get_expression();
    }

    parse_unit()
    {
        var tok =this.get_token();
        if (tok.is_invalid() || tok.type!='expression' || typeof(tok.value)!='string')
            return null;
        var lh =tok.value;
        
        tok =this.get_token();
        if (tok.is_invalid() || tok.type !='symbol' || tok.value!='<=>')
            return null;
        var rh =this.get_actual_expression();
        if (rh==null)
            return null;

        tok =this.get_token();
        if (tok.is_invalid() || tok.type !='symbol' || tok.value!=';')
            return null;

        this.append_output('New unit parsed successfully!');
        this.units.push(new Unit(lh, rh, this.parsed_str_expr));
        this.parsed_str_expr =[];
    }

    do_evaluate()
    {
        var expr =this.get_actual_expression();
        if (expr!=null) {
            this.get_token();
            this.append_output('The output is ' + expr.evaluate([]).toString());
        }
        else
            this.append_output('Failed to evaluate expression.');
    }

    extract_value(expr, result)
    {
        var _var =null;
        var _val =null;

        if (typeof(expr.lh) =='string')
            _var=expr.lh;
        if (typeof(expr.rh) instanceof Expression)
            _val =expr.rh.evaluate([]);
        else (typeof(expr.rh =='number'))
            _val =expr.rh;

        if (_var !=null && _val!=null) {
            if (result.has(_var)) ;
            else
                result.set(_var, _val);
        }
        return result;
    }
    

    get_values(expr, result= new Map())
    {
        if (expr.op==',') {
            if (expr.lh.op =='=')
                result =this.extract_value(expr.lh, result);
            if (expr.rh.op ==',')
                result =this.get_values(expr.rh, result);
            else if (expr.rh.op =='=')
                result =this.extract_value(expr.rh, result);
        }
        else if (expr.op =='=')
            result =this.extract_value(expr, result);
        return result;
    }

    do_convert()
    {
        var tok =this.get_token();
        if (tok.is_invalid() || tok.type!='expression' || typeof(tok.value)!='string')
            return;
        var unit_expr =tok.value;
        var unit_idx =0;
        while (unit_idx<this.units.length) {
            if (this.units[unit_idx].lh == unit_expr)
                break;
            unit_idx++;
        }

        var unit =this.units[unit_idx];
        tok =this.get_token();
        if (tok.is_invalid() || tok.type!='keyword' || tok.value!='where')
            return;

        var expr = this.get_actual_expression();
        this.get_token();

        var expr_map =this.get_values(expr);
        var has_all_exprs;
        {
            var i=0;
            while (i<unit.expr_lookup.length) {
                if (!expr_map.has(unit.expr_lookup[i]))
                    break;
                i++;
            }
            has_all_exprs =unit.expr_lookup.length==i;
        }
        var val;
        if (has_all_exprs)
            val = unit.rh.evaluate(expr_map);
        else
            this.append_output('Failed to evaluate expression due to missing variables.');
        this.append_output('The output is ' + val.toString());
    }

    do_list()
    {
        var i=0;
        while (i<this.units.length) {
            this.append_output('Unit ' + this.units[i].lh 
                + ' with arguements, ' 
                + this.units[i].expr_lookup.join(', '));
            i++;
        }
    }

    parse_statement(statement)
    {
        this.statement =statement;
        this.cursor =-1;
        this.parsed_str_expr =[];
        this.append_output('Statement: ' + statement);

        while (this.cursor<statement.length) {
            var tok = this.get_token();
            if (tok.is_invalid())
                break;
            else if (tok.type =='keyword') {
                switch (tok.value) {
                    case 'store': this.parse_unit(); break;
                    case 'convert': this.do_convert();break;
                    case 'list': this.do_list(); break;
                    case 'eval': this.do_evaluate(); break;
                    case 'help': this.append_help(); break;
                }
            }
        }
        this.flush();
    }

    get_numeric()
    {
        var start =this.cursor;
        var has_period=false;
        var end =0;
        do {
            var ch =this.get_char();
            if (ch==46) {
                if (has_period)
                    break;
                has_period =true;
                continue;
            }
        }
        while (ch!=null && (((ch>=48 && ch<=57) || ch==46)));
        var num =parseFloat(this.statement.substring(start, this.cursor));
        this.cursor--;
        return num;
    }

    get_string()
    {
        var start =this.cursor;
        var end =0;
        do 
            var ch =this.get_char();
        while (ch!=null && ((ch>=65 && ch<=90) || (ch>=97 && ch<=122)));

        var str =this.statement.substring(start, this.cursor);
        this.cursor--;
        return str;
    }

    get_symbol()
    {
        var i=0;
        var cur_cursor =this.cursor;
        while (i<this.symbols.length) {
            this.cursor =cur_cursor;
            var j=0;
            var ch = this.get_char();
            while (ch!=null && j<this.symbols[i].length && this.symbols[i].charCodeAt(j)==ch) {
                ch =this.get_char();
                j++;
            }

            if (j==this.symbols[i].length) {
                this.cursor--;
                return this.symbols[i];
            }
            i++;
        }
        return null;
    }

    get_token()
    {
        var ch =this.get_char();
        var type;
        var value =null;

        while (ch==32)
            ch =this.get_char();
        if (ch>=48 && ch<=57) {
            value =this.get_numeric();
            type ='expression';
        }
        else if ((ch>=65 && ch<=90) || (ch>=97 && ch<=122)) {
            value = this.get_string();
            type = this.keywords.includes(value) ? 'keyword' : 'expression';
        }
        else if (ch==null)
            return Token.empty();
        else  {
            this.cursor--;
            value =this.get_symbol();
            type ='symbol';
        }
        if (value==null)
            return Token.empty();

        return new Token(type, value);
    }

    peek_token()
    {
        var cursor =this.cursor;
        var result =this.get_token();
        this.cursor =cursor;
        return result;
    }

    get_char()
    {
        this.cursor++;
        if (this.cursor==this.statement.length)
            return null;
        return this.statement.charCodeAt(this.cursor);
    }
}

function load_units()
{
    return [];
}
var calculator =new Calculator(load_units());

function deactivate_and_activate_cur(id)
{
    var page =id +'_page';
    var active =document.getElementsByClassName("cmm_icon_header_active");
    var active_sidebar = document.getElementsByClassName("cmm_icon_sidebar_active");

    var inactive =document.getElementById(id);
    var inactive_sidebar =document.getElementById(id + "_sidebar")
    var page=document.getElementById(page);
    if (active.length>0) {
        var cur =active[0];
        if (cur.id==id)
            return;

        cur.classList.remove("cmm_icon_header_active");
        cur.classList.add("cmm_icon_header_inactive");
    }
    active_sidebar[0].classList.remove("cmm_icon_sidebar_active");
    if (inactive!=null) {
        inactive.classList.remove("cmm_icon_header_inactive");
        inactive.classList.add("cmm_icon_header_active");
    }
    inactive_sidebar.classList.add("cmm_icon_sidebar_active");
    var pages =document.getElementsByClassName("cmm_page");
    if (pages.length>0) {
        var i=0;
        while (i<pages.length) {
            var cur_page =pages[i];
            cur_page.style.display = "none";
            i++;
        }
    }
    page.style.display ='block';
}
function update_tab_bar() {
    var tab_bar =document.getElementById("tab-bar");
    if (tab_bar!=null) {
        var tab_bar_rect =tab_bar.getBoundingClientRect();
        var last_child =tab_bar.lastElementChild;
        var last_child_rect =last_child.getBoundingClientRect();
        var right1 =last_child_rect.x+last_child_rect.width;
        var right2 =tab_bar_rect.x+tab_bar_rect.width;
        
        if (right1 > right2) {
            tab_bar.style.height = tab_bar.parentElement.clientHeight;
            tab_bar.style.setProperty("overflow-x", "scroll");

        }
        else {
            tab_bar.style.height = tab_bar.parentElement.clientHeight;
            tab_bar.style.setProperty("overflow-x", "hidden");
        }
    }
}
function deactivate_and_activate_dropdown(dropdown_box_id, dropdown_id)
{
    var dropdown_box = document.getElementById(dropdown_box_id);
    var dropdown =document.getElementById(dropdown_id);
    if (dropdown_box!=null && dropdown!=null) {
        if (dropdown_box.classList.contains("cmm_dropdown_box_inactive")) {
            dropdown_box.classList.remove("cmm_dropdown_box_inactive");
            dropdown.classList.add("cmm_dropdown_active");
            dropdown_box.classList.add("cmm_dropdown_box_active");
        }
        else {
            dropdown_box.classList.remove("cmm_dropdown_box_active");
            dropdown.classList.remove("cmm_dropdown_active");
            dropdown_box.classList.add("cmm_dropdown_box_inactive");
        }
    }
}
function load_side_bar()
{
    var tab_bar =document.getElementById("tab-bar");
    // var side_bar =document.getElementById("side-bar");
    // if (tab_bar!=null) {
    //     var items =tab_bar.getElementsByClassName("cmm_icon_header");
    //     if (items.length>0) {
    //         {
    //             var i=0;
    //             while (i<items.length) {
    //                 var new_div =document.createElement("div");
    //                 side_bar.appendChild(.items[i].
    //             }
    //         }
    //     }
    // }
}
function do_calculator_input()
{
    var input = document.getElementById("text_input");
    if (input!=null) {
        var input_value = input.value;
        calculator.parse_statement(input_value);
        input.value ='';
    }
}
window.onload = (event) =>
{
    window.onresize = update_tab_bar;
    update_tab_bar();
    load_side_bar();
    var text_input =document.getElementById('text_input');
    text_input.addEventListener('keydown', (ev) => {
        if (ev.keyCode==13)
            do_calculator_input();
    })
    calculator.document_init();
}