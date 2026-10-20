---
title: picjs Grammar
description: The picjs grammar, as annotated EBNF
layout: layouts/doc.njk
eleventyNavigation:
  key: Grammar
  order: 5
---

<!-- Generated from src/peg_parser/jp.pegjs by docs/tools/extract-grammar.cjs. Do not edit. -->

This is the grammar that picjs's parser is built from, written as EBNF. It is
generated from the parser's grammar, `src/peg_parser/jp.pegjs`, so it is always
current.

Rules are listed from the top down, starting with `Start`. Each rule appears
once, under the first rule that uses it, and the rules under one rule are in
alphabetical order. The notes come from the comments in the grammar.

## Notation

The grammar is a PEG (parsing expression grammar), so it differs from ordinary
EBNF in two ways:

- **Alternatives are tried in order**, and the first that matches wins: in
  `A | B`, `B` is tried only if `A` fails.
- **Lookaheads** check what comes next without consuming it: `!X` matches
  only where `X` does not, and `&X` only where it does.

| Notation | Means |
|----------|-------|
| `'word'` | the characters, exactly (`'word'i` ignores case) |
| `[a-z]`, `[^"]` | one character in, or not in, the set |
| `.` | any one character |
| `X?`, `X*`, `X+` | `X` optionally, zero or more times, one or more times |
| `? … ?` | described in words |

Spacing is explicit: `_` is optional space, `__` is required space, and
`SameLineSpace` is space that doesn't include a newline. Space includes
comments. A keyword such as `'move'` only matches the whole word, so
`mover` is a name, not `move` followed by `r`. The keywords, with their
abbreviations, are [listed at the end](#keywords).

## Programs

```ebnf
Start           = _ Program _ EOF ;
```

A program is a list of expressions (statements). There are no separators; whitespace (including newlines) delimits statements.

```ebnf
Program         = ExpressionList? ;
```

```ebnf
ExpressionList  = Expression ( _ Expression )+
                | Expression ;
```

```ebnf
Expression      = Inspect
                | ShapeDefaultSetter
                | GroupExpression
                | Shape
                | AnimationSequence
                | Assignment
                | IfExpression
                | LogicalORExpression ;
```

## `ActualFontSize`

```ebnf
ActualFontSize  = ( 'xx-small' | 'x-small' | 'small' | 'medium' | 'large' |
                    'x-large' | 'xx-large' | 'xxx-large' | 'smaller' |
                    'larger' ) !IdentifierPart
                | Percent
                | SimpleDecimalNumber SizeUnit ;
```

## `AdditiveExpression`

```ebnf
AdditiveExpression
                = MultiplicativeExpression ( _ AdditiveOperator _
                    MultiplicativeExpression )* ;
```

```ebnf
AdditiveOperator
                = '+'
                | '-' !'>' ;
```

```ebnf
MultiplicativeExpression
                = PowerExpression ( _ MultiplicativeOperator _
                    PowerExpression )* ;
```

```ebnf
MultiplicativeOperator
                = '*'
                | '/'
                | '%' ;
```

```ebnf
PowerExpression
                = UnaryExpression ( _ '^' _ UnaryExpression )* ;
```

```ebnf
UnaryExpression
                = UnaryOperator _ QualifiedExpression
                | QualifiedExpression ;
```

```ebnf
QualifiedExpression
                = FunctionDefOrPrimary Qualifier* ;
```

The leaves of the expression tree: literals, variables, parenthesized exprs, and function definitions.

```ebnf
FunctionDefOrPrimary
                = FunctionDefinitionExpression
                | Primary ;
```

Arrow function syntax: (params) =\> body, name =\> body, or =\> body

```ebnf
FunctionDefinitionExpression
                = '(' _ FormalParameterList _ ')' _ '=>' _ FunctionBody
                | Identifier _ '=>' _ FunctionBody
                | ( '(' _ ')' _ )? '=>' _ FunctionBody ;
```

```ebnf
FormalParameterList
                = Identifier ( _ ( ',' _ )? Identifier )* ;
```

```ebnf
FunctionBody    = '{' _ ExpressionList _ '}'
                | Expression ;
```

```ebnf
Primary         = ShapeReference
                | Number
                | Boolean
                | Color
                | Position
                | String
                | SetTime
                | TimelineValue
                | ShapeDefaultGetter
                | VariableValue
                | ArrayOrRange
                | '(' _ Expression _ ')' ;
```

\[a, b, c\] for arrays, \[start..end\] for ranges. Commas are optional.

```ebnf
ArrayOrRange    = '[' _ Expression _ '..' _ Expression _ ']'
                | '[' _ ElementList _ ']'
                | '[' _ ']' ;
```

```ebnf
ElementList     = Expression ( _ ( ',' _ )? Expression )* ;
```

```ebnf
Boolean         = 'true'
                | 'false' ;
```

Named (~red), hex (\#rgb, \#rrggbb), model (rgb(...), oklch(...)), or dynamic (~\#{expr}) colors.

```ebnf
Color           = ColorModel '(' _ ColorComponents _ ')'
                | '#' HexByte HexByte HexByte HexByte? !HexNibble
                | '#' HexNibble HexNibble HexNibble HexNibble? !HexNibble
                | '~#{' _ Expression _ '}'
                | '~' [a-zA-Z0-9]+ ;
```

```ebnf
ColorComponents
                = Expression _ ',' _ Expression _ ',' _ Expression _ ',' _
                    Expression
                | Expression _ ',' _ Expression _ ',' _ Expression ;
```

```ebnf
ColorModel      = ( 'oklch'i | 'rgb'i | 'hsl'i | 'hsv'i ) 'a'i? ;
```

move, rotate, set, draw, pause — each with optional take/ease params. Animations can be chained with "then" for sequential execution.

```ebnf
SetTime         = '@@' ;
```

```ebnf
ShapeDefaultGetter
                = ShapeName SEClass '.' AttrName
                | ShapeName '.' AttrName ;
```

```ebnf
TimelineValue   = '@' ![.([] ;
```

```ebnf
UnaryOperator   = '+'
                | '-' !'>'
                | '!' ;
```

## `AnimationSequence`

```ebnf
AnimationSequence
                = Animation ( _ 'then' __ Animation )+
                | Animation ;
```

```ebnf
Animation       = 'move' __ Expression __ CardinalVector __ AdditiveExpression _
                    AnimationParams
                | 'move' __ Expression __ CardinalVector _ AnimationParams
                | 'move' __ Expression _ ( 'to' __ )? Expression _
                    AnimationParams
                | 'rotate' __ Expression __ 'by' __ Expression _ 'about' __
                    PositionValue _ AnimationParams
                | 'rotate' __ Expression __ 'by' __ Expression _ AnimationParams
                | 'set' __ LValue ( _ ',' _ | __ ( 'to' __ )? ) Expression _
                    AnimationParams
                | 'draw' __ Expression _ AnimationParams
                | 'pause' __ LogicalORExpression
                | 'pause' ;
```

```ebnf
AnimationParams
                = AnimationParam* ;
```

```ebnf
AnimationParam  = 'take' __ Expression _
                | 'ease' __ String _
                | 'ease' __ [a-zA-Z] [a-zA-Z0-9]* _ ;
```

## `Assignment`

Supports simple (=) and compound (+=, -=, \*=, /=, %=) assignment. LValues can be identifiers, qualified paths (obj.attr, list\[i\]), or @ (timeline).

```ebnf
Assignment      = LValue _ '=' ![=>] _ Expression
                | LValue _ AssignmentOperator '=' _ Expression ;
```

```ebnf
AssignmentOperator
                = '*'
                | '/'
                | '%'
                | '+'
                | '-' ;
```

## `AttrName`

```ebnf
AttrName        = 'align'
                | 'at'
                | 'ccw'
                | 'cw'
                | 'dashed'
                | 'dotted'
                | 'ease'
                | 'fill'
                | 'font_family'
                | 'font_size'
                | 'font_stretch'
                | 'font_style'
                | 'font_variant'
                | 'font_weight'
                | 'font'
                | 'from'
                | ( 'height' | 'ht' )
                | ( 'length' | 'len' )
                | 'line_height'
                | 'maxwidth'
                | 'opacity'
                | ( 'padding' | 'pad' )
                | ( 'radius' | 'rad' | 'r' )
                | ( 'rotation' | 'rot' )
                | 'rx'
                | 'ry'
                | ( 'smooth' | 'curve' | 'curved' )
                | 'solid'
                | ( 'stepped' | 'step' )
                | 'straight'
                | 'stroke_width'
                | 'stroke'
                | 'take'
                | ( 'thickness' | 'thick' )
                | 'to'
                | 'turn'
                | ( 'width' | 'wid' )
                | 'with'
                | 'x'
                | 'y' ;
```

## `Cardinal`

Cardinal vectors (north, south, etc.) for layout directions

```ebnf
Cardinal        = '.' ( 'nw' | 'ne' | 'n' | 'sw' | 'se' | 's' | 'w' | 'e' |
                    'c' ) !IdentifierPart ;
```

## `CardinalVector`

```ebnf
CardinalVector  = 'northwest' !IdentifierPart
                | 'northeast' !IdentifierPart
                | 'north' !IdentifierPart
                | 'southwest' !IdentifierPart
                | 'southeast' !IdentifierPart
                | 'south' !IdentifierPart
                | 'west' !IdentifierPart
                | 'east' !IdentifierPart
                | 'nw' !IdentifierPart
                | 'ne' !IdentifierPart
                | 'sw' !IdentifierPart
                | 'se' !IdentifierPart
                | 'up' !IdentifierPart
                | 'down' !IdentifierPart
                | 'left' !IdentifierPart
                | 'right' !IdentifierPart
                | 'n' !IdentifierPart
                | 's' !IdentifierPart
                | 'w' !IdentifierPart
                | 'e' !IdentifierPart ;
```

## `DecimalDigit`

```ebnf
DecimalDigit    = [0-9] ;
```

## `DecimalIntegerLiteral`

```ebnf
DecimalIntegerLiteral
                = '0'
                | [1-9] DecimalDigit* ;
```

## `DecimalPoint`

```ebnf
DecimalPoint    = '.' !'.' ;
```

## `GroupExpression`

Groups ({ ... }) collect shapes into a shared coordinate space. Aside is a non-layout-affecting variant. Groups accept common options and with-constraints for positioning.

```ebnf
GroupExpression
                = 'Aside' _ '{' _ ExpressionList _ '}'
                | 'Group' ( __ SEGroupOption )* _ '{' _ ExpressionList _ '}'
                    ( __ SEGroupOption )* ( __ WithConstraint )? ( __
                    SEGroupOption )*
                | '{' _ ExpressionList _ '}' ( __ SEGroupOption )* ( __
                    WithConstraint )? ( __ SEGroupOption )* ;
```

Styling a group reads better before its body, positioning it after, so both are allowed. SERadii rounds the background's corners; SEPadding holds the children away from its edges.

```ebnf
SEGroupOption   = SEPadding
                | SERadii
                | SECommon ;
```

A single inset, or one per axis reusing the position literal.

```ebnf
SEPadding       = ( 'padding' | 'pad' ) __ Position
                | ( 'padding' | 'pad' ) __ Expression ;
```

## `HexByte`

```ebnf
HexByte         = HexNibble HexNibble ;
```

## `HexNibble`

```ebnf
HexNibble       = [0-9a-f]i ;
```

## `Identifier`

Start with letter, \_, or $; continue with those plus digits. @ is a special identifier for the timeline object.

```ebnf
Identifier      = !Reserved IdentifierStart IdentifierPart*
                | '@' ;
```

Words that cannot be used as identifiers. AlwaysReserved covers shape names, animation verbs, keywords, and constants. AttrName covers attribute keywords that are only reserved in attribute position.

```ebnf
Reserved        = AlwaysReserved ;
```

```ebnf
AlwaysReserved  = ( 'Arc' | 'arc' )
                | 'Aside'
                | ( 'Box' | 'box' )
                | ( 'Circle' | 'circle' )
                | ( 'Ellipse' | 'ellipse' )
                | 'Face'
                | 'Gap'
                | 'Goto'
                | 'Group'
                | ( 'Line' | 'line' )
                | 'Label'
                | ( 'Oval' | 'oval' )
                | 'Skip'
                | 'move'
                | 'pause'
                | 'rotate'
                | 'set'
                | 'then'
                | 'wait'
                | 'draw'
                | 'else'
                | 'if'
                | 'true'
                | 'false' ;
```

## `IdentifierPart`

```ebnf
IdentifierPart  = IdentifierStart
                | UnicodeCombiningMark
                | UnicodeDigit
                | UnicodeConnectorPunctuation
                | '\u200C'
                | '\u200D' ;
```

```ebnf
UnicodeCombiningMark
                = Mn
                | Mc ;
```

```ebnf
Mc              = ? Unicode Mc: Mark, Spacing Combining ? ;
```

```ebnf
Mn              = ? Unicode Mn: Mark, Nonspacing ? ;
```

```ebnf
UnicodeConnectorPunctuation
                = Pc ;
```

Punctuation, Connector

```ebnf
Pc              = [_\u203F-\u2040\u2054\uFE33-\uFE34\uFE4D-\uFE4F\uFF3F] ;
```

```ebnf
UnicodeDigit    = Nd ;
```

```ebnf
Nd              = ? Unicode Nd: Number, Decimal Digit ? ;
```

## `IdentifierStart`

```ebnf
IdentifierStart
                = UnicodeLetter
                | '_'
                | '$' ;
```

```ebnf
UnicodeLetter   = Lu
                | Ll
                | Lt
                | Lm
                | Lo
                | Nl ;
```

```ebnf
Ll              = ? Unicode Ll: Letter, Lowercase ? ;
```

```ebnf
Lm              = ? Unicode Lm: Letter, Modifier ? ;
```

```ebnf
Lo              = ? Unicode Lo: Letter, Other ? ;
```

```ebnf
Lt              = ? Unicode Lt: Letter, Titlecase ? ;
```

```ebnf
Lu              = ? Unicode Lu: Letter, Uppercase ? ;
```

```ebnf
Nl              = ? Unicode Nl: Number, Letter ? ;
```

## `IfExpression`

if (test) body \[else body\]. Body is a single expression or { block }.

```ebnf
IfExpression    = 'if' _ '(' _ LogicalORExpression _ ')' _ ExpressionOrBlock _
                    'else' _ ExpressionOrBlock
                | 'if' _ '(' _ LogicalORExpression _ ')' _ ExpressionOrBlock
                | LogicalORExpression ;
```

```ebnf
ExpressionOrBlock
                = '{' _ ExpressionList _ '}'
                | Expression ;
```

## `Inspect`

```ebnf
Inspect         = '??' _ Expression ;
```

## `LValue`

```ebnf
LValue          = '@' !'.'
                | BaseLValue Qualifier+
                | Identifier ;
```

```ebnf
BaseLValue      = '(' _ Expression _ ')'
                | ShapeReference
                | VariableValue ;
```

## `LogicalORExpression`

Standard precedence: OR \< AND \< equality \< relational \< additive \< multiplicative \< power \< unary

```ebnf
LogicalORExpression
                = LogicalANDExpression ( _ '||' _ LogicalANDExpression )* ;
```

```ebnf
LogicalANDExpression
                = EqualityExpression ( _ '&&' _ EqualityExpression )* ;
```

```ebnf
EqualityExpression
                = RelationalExpression ( _ EqualityOperator _
                    RelationalExpression )* ;
```

```ebnf
EqualityOperator
                = '=='
                | '!=' ;
```

```ebnf
RelationalExpression
                = AdditiveExpression ( _ RelationalOperator _
                    AdditiveExpression )* ;
```

```ebnf
RelationalOperator
                = '<='
                | '>='
                | '<' !( '-' | Identifier '>' )
                | '>' ;
```

## `NonShapeExpression`

```ebnf
NonShapeExpression
                = Inspect
                | Assignment
                | IfExpression
                | LogicalORExpression ;
```

## `Number`

Integers, decimals, scientific notation. Append % to divide by 100.

```ebnf
Number          = ActualNumber '%'
                | ActualNumber ;
```

```ebnf
ActualNumber    = DecimalIntegerLiteral DecimalPoint DecimalDigit+ ExponentPart?
                | DecimalPoint DecimalDigit+ ExponentPart?
                | DecimalIntegerLiteral ExponentPart? ;
```

```ebnf
ExponentPart    = 'e'i [+\-]? DecimalDigit+ ;
```

## `Percent`

```ebnf
Percent         = SimpleDecimalNumber '%' ;
```

## `Position`

(x, y) coordinate pair — comma is optional

```ebnf
Position        = '(' _ Expression _ ( ',' _ )? Expression _ ')' ;
```

## `PositionValue`

```ebnf
PositionValue   = Expression ;
```

## `Qualifier`

```ebnf
Qualifier       = Arguments
                | '[' _ Expression _ ']'
                | '.' ( AttrName | Identifier ) ;
```

```ebnf
Arguments       = '(' _ ArgumentList _ ')'
                | '(' _ ')' ;
```

```ebnf
ArgumentList    = Expression ( _ ( ',' _ )? Expression )* ;
```

## `RichLabel`

```ebnf
RichLabel       = '(' _ NonShapeExpression LabelTextAttr* _ ')' ;
```

```ebnf
LabelTextAttr   = __ SEText
                | __ SEFill
                | __ SEStroke
                | __ SEClass
                | __ ActualFontSize ;
```

## `SEClass`

```ebnf
SEClass         = '.' Identifier ;
```

## `SECommon`

```ebnf
SECommon        = SELabel
                | SERotation
                | SEPos
                | SEFill
                | SEStroke
                | SEStrokeAttr
                | SEOpacity
                | SEFit
                | SEBehind
                | SESame
                | SEClass
                | SEElementAttr ;
```

```ebnf
SEBehind        = 'behind' __ NonShapeExpression ;
```

Attributes copied onto the shape's outermost SVG element, for scripts and CSS. A bare value is taken as a single-word string, not an expression.

```ebnf
SEElementAttr   = 'attr' __ ElementAttrName __ ElementAttrValue
                | 'id' __ ElementAttrValue ;
```

```ebnf
ElementAttrName
                = [a-zA-Z] [a-zA-Z0-9\-]*
                | String ;
```

```ebnf
ElementAttrValue
                = [a-zA-Z0-9_.\-]+
                | String ;
```

```ebnf
SEFit           = 'fit' ;
```

```ebnf
SELabel         = RichLabel
                | String ;
```

```ebnf
SEOpacity       = 'opacity' __ Number ;
```

```ebnf
SEPos           = 'at' __ Expression
                | 'at'? _ Position
                | 'x' __ Expression
                | 'y' __ Expression ;
```

```ebnf
SERotation      = ( 'rotation' | 'rot' ) __ Expression __ 'about' _
                    PositionValue
                | ( 'rotation' | 'rot' ) __ Expression ;
```

```ebnf
SESame          = 'same' ;
```

## `SEFill`

```ebnf
SEFill          = 'fill' __ NonShapeExpression ;
```

## `SERadii`

```ebnf
SERadii         = ( 'rx' | 'ry' ) __ Expression
                | ( 'radius' | 'rad' | 'r' ) __ Expression ;
```

## `SEStroke`

```ebnf
SEStroke        = SEStrokeAttr ;
```

## `SEStrokeAttr`

```ebnf
SEStrokeAttr    = 'stroke' __ NonShapeExpression
                | ( ( 'thickness' | 'thick' ) | 'stroke_width' ) __
                    NonShapeExpression
                | 'solid' | 'dotted' | 'dashed' ;
```

## `SEText`

```ebnf
SEText          = 'align' __ Cardinal
                | 'maxwidth' __ Number
                | 'line_height' __ Number
                | 'font' __ FontSpec
                | 'font_size' __ ActualFontSize
                | 'font_weight' __ ( 'bold' | 'lighter' | 'darker' | [0-9] '00'
                    | 'normal' ) !IdentifierPart
                | 'font_style' __ ( 'italic' | 'oblique' | 'normal' )
                    !IdentifierPart
                | 'font_variant' __ ( 'small-caps' | 'normal' ) !IdentifierPart
                | 'font_stretch' __ ( 'ultra-condensed' | 'extra-condensed' |
                    'condensed' | 'semi-condensed' | 'semi-expanded' |
                    'expanded' | 'extra-expanded' | 'ultra-expanded' |
                    'normal' ) !IdentifierPart
                | ActualFontSize ;
```

A subset of CSS font syntax: \[style\] \[variant\] \[weight\] \[stretch\] size\[/line-height\] family

```ebnf
FontSpec        = FontProperties ;
```

```ebnf
FontProperties  = ( BeforeSizeProperty __ )* FontSize __ FontFamilyNames ;
```

```ebnf
BeforeSizeProperty
                = FontStyle
                | FontVariant
                | FontWeight
                | FontStretch ;
```

```ebnf
FontStretch     = IgnoreNormal
                | 'ultra-condensed' | 'extra-condensed' | 'condensed' |
                    'semi-condensed' | 'semi-expanded' | 'expanded' |
                    'extra-expanded' | 'ultra-expanded' | Percent ;
```

```ebnf
FontStyle       = IgnoreNormal
                | 'italic' !IdentifierPart | 'oblique' _ ObliqueAngle |
                    'oblique' !IdentifierPart ;
```

```ebnf
ObliqueAngle    = [+\-]? [0-9] [0-9] AngleUnit ;
```

```ebnf
AngleUnit       = 'deg'
                | 'grad'
                | 'rad'
                | 'turn' ;
```

```ebnf
FontVariant     = IgnoreNormal
                | 'small-caps' !IdentifierPart ;
```

```ebnf
FontWeight      = IgnoreNormal
                | 'bold' | 'lighter' | 'darker' | [0-9] '00' ;
```

```ebnf
FontFamilyNames
                = FontFamilyName ( _ ',' _ FontFamilyName )* ;
```

An unquoted name can be several words, so it ends at the end of the line or at an attribute keyword: in `font 12pt Georgia fill ~red` the family is Georgia

```ebnf
FontFamilyName  = '"' ( !'"' . )+ '"'
                | FontFamilyWord ( SameLineSpace FontFamilyWord )* ;
```

```ebnf
FontFamilyWord  = !AttrName Identifier ;
```

```ebnf
FontSize        = ActualFontSize '/' LineHeight
                | ActualFontSize ;
```

```ebnf
LineHeight      = IgnoreNormal
                | Percent
                | SimpleDecimalNumber SizeUnit? ;
```

```ebnf
IgnoreNormal    = 'normal' ;
```

## `SameLineSpace`

```ebnf
SameLineSpace   = ( '\t' | '\v' | '\f' | ' ' | '\u00A0' | '\uFEFF' | Zs )+ ;
```

## `Shape`

```ebnf
Shape           = ( 'Arc' | 'arc' ) __ FromPosition __ ToPosition ( _
                    ( SELineEndings | SELineDraw | SELineLabel | SECommon |
                    SETurn ) )*
                | ( 'Arc' | 'arc' ) __ SELineEndings __ FromPosition __
                    ToPosition ( _ ( SELineDraw | SELineLabel | SECommon |
                    SETurn ) )*
                | ( 'Arc' | 'arc' ) !'.' ( __ ( SELineEndings | SELineDraw |
                    SELineLabel | SECommon | SETurn ) )*
                | ( 'Box' | 'box' ) !'.' !'(' ( __ ( SECommon | SESize |
                    SERadii ) )* ( __ WithConstraint )? ( __ ( SECommon | SESize
                    | SERadii ) )*
                | ( 'Circle' | 'circle' ) !'.' !'(' ( __ ( SECommon |
                    SERadius ) )* ( __ WithConstraint )? ( __ ( SECommon |
                    SERadius ) )*
                | ( 'Ellipse' | 'ellipse' ) !'.' !'(' ( __ ( SECommon |
                    SERadii ) )* ( __ WithConstraint )? ( __ ( SECommon |
                    SERadii ) )*
                | ( 'Oval' | 'oval' ) !'.' !'(' ( __ ( SECommon | SESize |
                    SERadii ) )* ( __ WithConstraint )? ( __ ( SECommon | SESize
                    | SERadii ) )*
                | LineOrAbbrev __ FromPosition ( __ ThenToPosition )+ ( __
                    'close' )? ( _ ( SELineEndings | SELineDraw | SELineShape |
                    SELineLabel | SECommon | SERadii ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ FromPosition ( __
                    ThenToPosition )+ ( __ 'close' )? ( _ ( SELineDraw |
                    SELineShape | SELineLabel | SECommon | SERadii ) )*
                | LineOrAbbrev __ FromPosition __ ToPosition ( __
                    ThenToPosition )+ ( __ 'close' )? ( _ ( SELineEndings |
                    SELineDraw | SELineShape | SELineLabel | SECommon |
                    SERadii ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ FromPosition __
                    ToPosition ( __ ThenToPosition )+ ( __ 'close' )? ( _
                    ( SELineDraw | SELineShape | SELineLabel | SECommon |
                    SERadii ) )*
                | LineOrAbbrev __ FromPosition __ DirectionalWaypoint ( __
                    ThenToPosition )+ ( __ 'close' )? ( _ ( SELineEndings |
                    SELineDraw | SELineShape | SELineLabel | SECommon |
                    SERadii ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ FromPosition __
                    DirectionalWaypoint ( __ ThenToPosition )+ ( __ 'close' )?
                    ( _ ( SELineDraw | SELineShape | SELineLabel | SECommon |
                    SERadii ) )*
                | LineOrAbbrev __ DirectionalWaypoint ( __ ThenToPosition )+
                    ( __ 'close' )? ( _ ( SELineEndings | SELineDraw |
                    SELineShape | SELineLabel | SECommon | SERadii ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ DirectionalWaypoint
                    ( __ ThenToPosition )+ ( __ 'close' )? ( _ ( SELineDraw |
                    SELineShape | SELineLabel | SECommon | SERadii ) )*
                | LineOrAbbrev __ ToPosition ( __ ThenToPosition )+ ( __
                    'close' )? ( _ ( SELineEndings | SELineDraw | SELineShape |
                    SELineLabel | SECommon | SERadii ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ ToPosition ( __
                    ThenToPosition )+ ( __ 'close' )? ( _ ( SELineDraw |
                    SELineShape | SELineLabel | SECommon | SERadii ) )*
                | LineOrAbbrev __ FromPosition __ ToPosition ( _ ( SELineEndings
                    | SELineDraw | SELineShape | SELineLabel | SECommon ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ FromPosition __
                    ToPosition ( _ ( SELineDraw | SELineShape | SELineLabel |
                    SECommon ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ FromPosition ( _
                    ( SELineDraw | SELineShape | SELineLabel | SECommon |
                    SELineLength ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ ToPosition ( _
                    ( SELineDraw | SELineShape | SELineLabel | SECommon |
                    SELineLength ) )*
                | LineOrAbbrev __ FromPosition ( _ ( SELineEndings | SELineDraw
                    | SELineShape | SELineLabel | SECommon | SELineLength ) )*
                | LineOrAbbrev __ ToPosition ( _ ( SELineEndings | SELineDraw |
                    SELineShape | SELineLabel | SECommon | SELineLength ) )*
                | LineOrAbbrev __ DirectionalWaypoint ( _ ( SELineEndings |
                    SELineDraw | SELineLabel | SECommon | SELineShape ) )*
                | ( 'Line' | 'line' ) __ SELineEndings __ DirectionalWaypoint
                    ( _ ( SELineDraw | SELineLabel | SECommon | SELineShape ) )*
                | LineOrAbbrev !'.' ( __ ( SELineEndings | SELineDraw |
                    SELineLabel | SECommon | SELineShape | SELineLength ) )*
                | 'Label' __ ( ( SEText | SECommon ) __ )+ ( String |
                    RichLabel ) ( __ ( SEText | SECommon ) )* ( __
                    WithConstraint )?
                | 'Label' _ ( String | RichLabel ) ( __ ( SEText | SECommon ) )*
                    ( __ WithConstraint )?
                | 'Face' __ CardinalVector
                | 'Face' __ Expression
                | 'Gap' __ 'same'
                | 'Gap' __ CardinalVector SameLineSpace MoveDistance
                | 'Gap' __ CardinalVector
                | 'Gap' SameLineSpace MoveDistance
                | 'Gap'
                | 'Goto' SameLineSpace CardinalVector SameLineSpace MoveDistance
                | 'Goto' SameLineSpace CardinalVector
                | 'Goto' SameLineSpace Position
                | 'Goto' SameLineSpace PositionValue
                | 'Goto' SameLineSpace MoveDistance
                | 'Goto'
                | 'Skip' __ SkipArgs ;
```

```ebnf
DirectionalWaypoint
                = DirectionalComponent __ DirectionalComponent
                | DirectionalComponent ;
```

```ebnf
DirectionalComponent
                = CardinalVector __ LogicalORExpression ;
```

From/to positions, waypoints (directional and absolute), and line abbreviations.

```ebnf
FromPosition    = 'from' __ PositionValue
                | Position ;
```

```ebnf
LineOrAbbrev    = ( 'Line' | 'line' )
                | SELineEndings ;
```

```ebnf
MoveDistance    = AdditiveExpression ;
```

```ebnf
SELineDraw      = 'nodraw' !IdentifierPart ;
```

```ebnf
SELineEndings   = '--'
                | '~~'
                | SELineEndStart LinePath SELineEndEnd
                | SELineEndStart LinePath
                | LinePath SELineEndEnd ;
```

```ebnf
LinePath        = '-'
                | '~' ;
```

```ebnf
SELineEndEnd    = '>'
                | '|'
                | 'o' ;
```

```ebnf
SELineEndStart  = '<'
                | '|'
                | 'o' ;
```

Line labels with optional path position (at \<percent\>) and side (above/below/inside/outside) Both orderings are accepted: "label" above at 60%  OR  "label" at 60% above Returns { \_lineLabel: { text, pathPercent, side } } which gets merged into shape args

```ebnf
SELineLabel     = RichLabel __ ( 'above' | 'below' | 'inside' | 'outside' ) ( __
                    'at' __ Number )?
                | RichLabel __ 'at' __ Number ( __ ( 'above' | 'below' |
                    'inside' | 'outside' ) )?
                | RichLabel
                | String __ ( 'above' | 'below' | 'inside' | 'outside' ) ( __
                    'at' __ Number )?
                | String __ 'at' __ Number ( __ ( 'above' | 'below' | 'inside' |
                    'outside' ) )?
                | String ;
```

```ebnf
SELineLength    = ( 'length' | 'len' ) __ Expression ;
```

```ebnf
SELineShape     = 'straight'
                | ( 'stepped' | 'step' )
                | ( 'smooth' | 'curve' | 'curved' ) ;
```

```ebnf
SERadius        = ( 'radius' | 'rad' | 'r' ) __ Expression ;
```

Width and height can't be assignments, and the "x" must be on the width's line and not start a name, so `Box` followed by lines like `b = Box` and `xs = 100` aren't taken as a size. "2x3" still is.

```ebnf
SESize          = LogicalORExpression SameLineSpace? [x\u00D7] !IdentifierStart
                    _ LogicalORExpression
                | ( 'width' | 'wid' ) __ Expression
                | ( 'height' | 'ht' ) __ Expression ;
```

```ebnf
SETurn          = ( 'turn' __ )? ( 'ccw' | 'cw' )
                | 'turn' __ Expression ;
```

```ebnf
SkipArgs        = 'to' __ Expression
                | Position
                | 'x' __ Expression __ 'y' __ Expression
                | 'y' __ Expression __ 'x' __ Expression ;
```

```ebnf
ThenToPosition  = 'then' __ CardinalVector __ 'until' __ ( ( 'even' | 'level' )
                    __ 'with' __ )? PositionValue
                | 'then' __ DirectionalWaypoint
                | 'then' __ ( 'to' __ )? PositionValue ;
```

```ebnf
ToPosition      = 'to' __ PositionValue
                | Position ;
```

## `ShapeDefaultSetter`

```ebnf
ShapeDefaultSetter
                = ShapeName SEClass '.' AttrName _ '=' _ Expression
                | ShapeName '.' AttrName _ '=' _ Expression ;
```

## `ShapeName`

The shapes that can carry defaults. Aside is absent on purpose: it creates no shape, so `Aside.fill = …` would be stored under a name nothing reads.

```ebnf
ShapeName       = ( 'Arc' | 'arc' ) | ( 'Box' | 'box' ) | ( 'Circle' |
                    'circle' ) | ( 'Ellipse' | 'ellipse' ) | ( 'Oval' | 'oval' )
                    | ( 'Line' | 'line' ) | 'Label' | 'Skip' | 'Group'
                | 'Shape' !IdentifierPart ;
```

## `ShapeReference`

"last box", "2nd circle", "second last line": a shape drawn earlier, counted in the order shapes were drawn. The ordinal words are not reserved: they only mean this when a shape name follows on the same line.

```ebnf
ShapeReference  = Ordinal SameLineSpace ( 'last' !IdentifierPart
                    SameLineSpace )? ShapeReferenceName
                | 'last' !IdentifierPart SameLineSpace ShapeReferenceName ;
```

```ebnf
Ordinal         = [0-9]+ ( 'st' | 'nd' | 'rd' | 'th' ) !IdentifierPart
                | 'first' !IdentifierPart
                | 'second' !IdentifierPart
                | 'third' !IdentifierPart
                | 'fourth' !IdentifierPart
                | 'fifth' !IdentifierPart
                | 'sixth' !IdentifierPart
                | 'seventh' !IdentifierPart
                | 'eighth' !IdentifierPart
                | 'ninth' !IdentifierPart
                | 'tenth' !IdentifierPart ;
```

The shapes that can be referred to: ShapeName without Skip, which draws nothing

```ebnf
ShapeReferenceName
                = ( 'Arc' | 'arc' ) | ( 'Box' | 'box' ) | ( 'Circle' |
                    'circle' ) | ( 'Ellipse' | 'ellipse' ) | ( 'Oval' | 'oval' )
                    | ( 'Line' | 'line' ) | 'Label' | 'Group'
                | 'Shape' !IdentifierPart ;
```

## `SimpleDecimalNumber`

```ebnf
SimpleDecimalNumber
                = DecimalIntegerLiteral ( DecimalPoint DecimalDigit* )? ;
```

## `SizeUnit`

```ebnf
SizeUnit        = ( 'Q' | 'ch' | 'cm' | 'em' | 'ex' | 'in' | 'lh' | 'mm' | 'pc'
                    | 'pt' | 'px' | 'rem' | 'vh' | 'vmax' | 'vmin' | 'vw' )
                    !IdentifierPart ;
```

## `String`

Single/double quoted with escape sequences. Double-quoted support \#{expr} interpolation. Triple-quoted (''' and """) for multi-line strings.

```ebnf
String          = '"""' TripleDoubleStringPart* '"""'
                | "'''" TripleSingleStringCharacter* "'''"
                | '"' DoubleStringPart* '"'
                | "'" SingleStringCharacter* "'" ;
```

Double-quoted strings support \#{expr} interpolation and \#\# for literal \#

```ebnf
DoubleStringPart
                = '#{' _ Expression _ '}'
                | '##'
                | DoubleStringCharacter+ ;
```

```ebnf
DoubleStringCharacter
                = !( '"' | '\\' | '#{' | '##' | LineTerminator ) .
                | '\\' EscapeSequence
                | LineContinuation ;
```

```ebnf
EscapeSequence  = CharacterEscapeSequence
                | '0' !DecimalDigit
                | HexEscapeSequence
                | UnicodeEscapeSequence ;
```

```ebnf
CharacterEscapeSequence
                = SingleEscapeCharacter
                | NonEscapeCharacter ;
```

```ebnf
NonEscapeCharacter
                = !( EscapeCharacter | LineTerminator ) . ;
```

```ebnf
EscapeCharacter
                = SingleEscapeCharacter
                | DecimalDigit
                | 'x'
                | 'u' ;
```

```ebnf
SingleEscapeCharacter
                = "'"
                | '"'
                | '\\'
                | 'b'
                | 'f'
                | 'n'
                | 'r'
                | 't'
                | 'v' ;
```

```ebnf
HexEscapeSequence
                = 'x' HexByte ;
```

```ebnf
UnicodeEscapeSequence
                = 'u' HexByte HexByte? ;
```

```ebnf
LineContinuation
                = '\\' LineTerminatorSequence ;
```

```ebnf
LineTerminatorSequence
                = '\n'
                | '\r\n'
                | '\r'
                | '\u2028'
                | '\u2029' ;
```

```ebnf
SingleStringCharacter
                = !( "'" | '\\' | LineTerminator ) .
                | '\\' EscapeSequence
                | LineContinuation ;
```

Triple-double-quoted strings also support interpolation

```ebnf
TripleDoubleStringPart
                = '#{' _ Expression _ '}'
                | '##'
                | TripleDoubleStringCharacter+ ;
```

```ebnf
TripleDoubleStringCharacter
                = !( '"""' | '#{' | '##' ) . ;
```

```ebnf
TripleSingleStringCharacter
                = !"'''" . ;
```

## `VariableValue`

```ebnf
VariableValue   = Identifier ;
```

## `WithConstraint`

```ebnf
WithConstraint  = 'with' __ SelfAnchor ( _ 'at' )? _ Expression
                | 'with' __ ( _ Cardinal )? ( _ 'at' )? _ Expression ;
```

```ebnf
SelfAnchor      = 'self.' Identifier Cardinal? ;
```

## `__`

```ebnf
__              = WhiteSpace+ ;
```

## Spacing

```ebnf
EOF             = !. ;
```

```ebnf
LineTerminator  = [\n\r\u2028\u2029] ;
```

```ebnf
WhiteSpace      = '\t'
                | '\v'
                | '\f'
                | ' '
                | '\u00A0'
                | '\uFEFF'
                | Zs
                | Comment
                | LineTerminator ;
```

```ebnf
Comment         = '//' ( !LineTerminator . )* ;
```

```ebnf
Zs              = ? Unicode Zs: Separator, Space ? ;
```

\_ = optional whitespace, \_\_ = required whitespace, SameLineSpace = no newlines. Comments are // to end-of-line.

```ebnf
_               = WhiteSpace* ;
```

## Keywords

These are written as words in the rules above. Where a keyword has more than
one spelling, any of them may be used.

| Keyword | Spellings |
|---------|-----------|
| about | `about` |
| above | `above` |
| align | `align` |
| Arc | `Arc`, `arc` |
| Aside | `Aside` |
| at | `at` |
| attr | `attr` |
| behind | `behind` |
| below | `below` |
| Box | `Box`, `box` |
| by | `by` |
| ccw | `ccw` |
| Circle | `Circle`, `circle` |
| close | `close` |
| cw | `cw` |
| dashed | `dashed` |
| dotted | `dotted` |
| draw | `draw` |
| ease | `ease` |
| Ellipse | `Ellipse`, `ellipse` |
| else | `else` |
| Face | `Face` |
| false | `false` |
| fill | `fill` |
| fit | `fit` |
| font | `font` |
| font_family | `font_family` |
| font_size | `font_size` |
| font_stretch | `font_stretch` |
| font_style | `font_style` |
| font_variant | `font_variant` |
| font_weight | `font_weight` |
| from | `from` |
| Gap | `Gap` |
| Goto | `Goto` |
| Group | `Group` |
| height | `height`, `ht` |
| id | `id` |
| if | `if` |
| inside | `inside` |
| Label | `Label` |
| length | `length`, `len` |
| Line | `Line`, `line` |
| line_height | `line_height` |
| maxwidth | `maxwidth` |
| move | `move` |
| opacity | `opacity` |
| outside | `outside` |
| Oval | `Oval`, `oval` |
| padding | `padding`, `pad` |
| pause | `pause` |
| radius | `radius`, `rad`, `r` |
| rotate | `rotate` |
| rotation | `rotation`, `rot` |
| rx | `rx` |
| ry | `ry` |
| same | `same` |
| set | `set` |
| Skip | `Skip` |
| smooth | `smooth`, `curve`, `curved` |
| solid | `solid` |
| stepped | `stepped`, `step` |
| straight | `straight` |
| stroke | `stroke` |
| stroke_width | `stroke_width` |
| take | `take` |
| then | `then` |
| thickness | `thickness`, `thick` |
| to | `to` |
| true | `true` |
| turn | `turn` |
| wait | `wait` |
| width | `width`, `wid` |
| with | `with` |
| x | `x` |
| y | `y` |
