const {test}=require('node:test');const assert=require('node:assert/strict');const F=require('../js/formula.js');const E=require('../js/effects.js');
test('existing formulas roundtrip without changing precedence or division behavior',()=>{
 const cases=['enemy.hp * 0.2 + 5','(enemy.hp + 5) * 0.2','10-(3-2)','10/(2*5)','10/(2/5)','-(-self.hp + 5)','2*-3','+5','1 / (self.shield - self.shield)','self.hp / (enemy.hp / 2)','(1+2)*(3+4)'];
 for(const formula of cases){const result=F.serialize(F.parse(formula));for(const values of [{'enemy.hp':180,'self.hp':120,'self.shield':0},{'enemy.hp':0,'self.hp':1,'self.shield':20}])assert.equal(E.calculate(result,values),E.calculate(formula,values),formula);}
});
test('visual edits build nested groups, change references and preserve invalid empty leaves',()=>{
 const tree=F.parse('enemy.hp*0.2+5');tree.left.right.value='0.5';assert.equal(E.calculate(F.serialize(tree),{'enemy.hp':100}),55);
 tree.right={kind:'binary',op:'/',left:{kind:'ref',value:'self.posture'},right:{kind:'number',value:'2'}};assert.equal(E.calculate(F.serialize(tree),{'enemy.hp':100,'self.posture':80}),90);
 tree.right.right.value='';assert.throws(()=>E.calculate(F.serialize(tree)));
});
test('malformed input never becomes a silently corrected formula',()=>{for(const formula of ['','2+','alert(1)','(3*4','2**3'])assert.throws(()=>F.parse(formula));});

test('attack references roundtrip and read distinct caster, enemy and recipient base attack',()=>{
 const formula='self.attack+enemy.attack+target.attack*2';
 assert.equal(F.serialize(F.parse(formula)),formula);
 const effect=E.validate({type:'heal',amount:{formula}},{allowAttack:false});
 const context={self:{attack:20,outputBonuses:{damage:100}},enemy:{attack:13},target:{attack:7},allowAttack:false};
 assert.equal(E.amount(effect,{tick:0},0,context),47);
 assert.equal(E.amount(effect,{tick:0},0,{...context,enemy:null}),34);
});

