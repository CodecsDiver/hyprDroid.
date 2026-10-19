class_name StatModifier
extends Resource
## One stat change contributed by an upgrade or item.
##
## Final stat = (base + sum(ADD)) * (1 + sum(ADD_PERCENT)) * product(MULTIPLY).
## Stacking is LINEAR (value * stacks, or value ^ stacks for MULTIPLY) or HYPERBOLIC:
## the first stack gives exactly `value`, further stacks approach `hyperbolic_cap`
## asymptotically (Risk of Rain 2 style diminishing returns).

enum Operation { ADD, ADD_PERCENT, MULTIPLY }
enum StackMode { LINEAR, HYPERBOLIC }

@export var stat: StringName = &""
@export var operation: Operation = Operation.ADD
@export var value: float = 0.0
@export var stack_mode: StackMode = StackMode.LINEAR
## Asymptote of the stacked total when stack_mode is HYPERBOLIC. Must exceed `value`.
@export var hyperbolic_cap: float = 1.0


## Total contribution of this modifier at the given stack count.
## For ADD and ADD_PERCENT this is the amount added; for MULTIPLY it is the factor.
func effective_value(stacks: int) -> float:
	if stacks <= 0:
		return 1.0 if operation == Operation.MULTIPLY else 0.0
	if stack_mode == StackMode.HYPERBOLIC and operation != Operation.MULTIPLY:
		return hyperbolic_total(value, hyperbolic_cap, stacks)
	if operation == Operation.MULTIPLY:
		return pow(value, stacks)
	return value * stacks


## Diminishing-returns curve: total(1) == first_stack_value, total(inf) == cap.
static func hyperbolic_total(first_stack_value: float, cap: float, stacks: int) -> float:
	if stacks <= 0:
		return 0.0
	if cap <= first_stack_value or first_stack_value <= 0.0:
		push_warning("StatModifier: invalid hyperbolic parameters (value=%s cap=%s); using linear." % [first_stack_value, cap])
		return first_stack_value * stacks
	var slope: float = first_stack_value / (cap - first_stack_value)
	var scaled: float = slope * float(stacks)
	return cap * scaled / (1.0 + scaled)


## Human readable single-stack summary such as "+20 Max Health" or "+10% Damage".
func describe() -> String:
	var stat_label: String = StatIds.display_name(stat)
	var suffix: String = " (diminishing)" if stack_mode == StackMode.HYPERBOLIC else ""
	match operation:
		Operation.ADD:
			if StatIds.is_percent_stat(stat):
				return "%+d%% %s%s" % [roundi(value * 100.0), stat_label, suffix]
			return "%s%s %s%s" % ["+" if value >= 0.0 else "", String.num(value, 2), stat_label, suffix]
		Operation.ADD_PERCENT:
			return "%+d%% %s%s" % [roundi(value * 100.0), stat_label, suffix]
		_:
			return "x%.2f %s%s" % [value, stat_label, suffix]
