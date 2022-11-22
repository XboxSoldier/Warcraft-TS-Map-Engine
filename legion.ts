import {BCFunc, BCConstants, BCApp, BCFolder, BCStorage, BCEvent, BCValiador, BCValiadorGroup, BCEffect, BCEffectGroup, BCScore, BCSet, BCRange, BCAttribute,
BCTrigger, BCTriggerGenerator, BCBuffLink, BCBehaviorPrototype, BCBehavior, BCWorld, BCDummy, BCPopup, BCDamage, BCRestore, BCUnit,
RelativisticMissiles} from 'BCEngine';

/*
    Fel Houndn
*/
    let felHound = FourCC('lu00');

    /*
        Leech Skill
    */
        let felHoundLeechSkill = FourCC('la00');
        let felHoundLeechSkillBehavior = new BCBehaviorPrototype('felHoundLeechSkillBehavior', true, true);
        let felHoundLeechSkillBehaviorEffect = new BCEffect(function (this: any, thisEvent: BCEvent) {
            let behavior = BCBehavior.search(felHoundLeechSkillBehavior, thisEvent.target);
            if (behavior && !behavior.flags.has('destroying') && behavior.value > 0) {
                let reduction = math.min(behavior.value, thisEvent.value);
                behavior.value -= reduction;
                thisEvent.value -= reduction;
                if (BCConstants.popupValue) {
                    let size = BCDamage.damagePopupSize;
                    let fac = thisEvent.value / BCDamage.damagePopupBase;

                    if (fac < 1 ) {
                        size *= Pow(1.25, fac) - 0.25;
                    }
                    else {
                        size *= 1.5 - 0.5 / fac;
                    }
                    new BCPopup('|cffcccccc' + I2S(R2I(reduction)) + '|r', thisEvent.target, size, size * 0.50);
                }
            }
        });
        felHoundLeechSkillBehaviorEffect.addValiador(new BCValiador(function (this: any, thisEvent: BCEvent) {
            return thisEvent.get('flags').has('attack');
        }));
        felHoundLeechSkillBehavior.duration = 8;
        felHoundLeechSkillBehavior.linkBuff(false, FourCC('lb00'), FourCC('lc00'), 1, 'innerfire');
        felHoundLeechSkillBehavior.addValiador(new BCValiador(function (thisEvent: BCEvent) {
            return thisEvent.item.value > 0;
        }));
        felHoundLeechSkillBehavior.addValiador(BCConstants.valiadors.exist);
        felHoundLeechSkillBehavior.addValiador(BCConstants.valiadors.targetAlive);
        felHoundLeechSkillBehavior.applyEffect(new BCEffect(function (this: any, thisEvent: BCEvent) {
            if (thisEvent.target) {
                BCDamage.event5b.register(thisEvent.target, felHoundLeechSkillBehaviorEffect, 1);
            }
        }));
        felHoundLeechSkillBehavior.expireEffect(new BCEffect(function (this: any, thisEvent: BCEvent) {
            if (thisEvent.target) {
                BCDamage.event5b.register(thisEvent.target, felHoundLeechSkillBehaviorEffect, -1);
            }
        }));

        let felHoundLeechMarker = new BCBehaviorPrototype('felHoundLeechSkillMarker', true, true);
        let felHoundLeechMarkerEffect = new BCEffect(function (this: any, thisEvent: BCEvent) {
            let behavior = BCBehavior.search(felHoundLeechSkillBehavior, thisEvent.source);
            if (!behavior || behavior.flags.has('destroying')) {
                behavior = new BCBehavior(felHoundLeechSkillBehavior, thisEvent.source, thisEvent.source);
                behavior.value = thisEvent.value * 0.20;
            }
            else {
                behavior.value += thisEvent.value * 0.20;
                behavior.expired = 0;
            }
        });
        felHoundLeechMarkerEffect.addValiador(new BCValiador(function (this: any, thisEvent: BCEvent) {
            return thisEvent.get('flags').has('attack');
        }));
        felHoundLeechMarker.addValiador(BCConstants.valiadors.exist);
        felHoundLeechMarker.addValiador(BCConstants.valiadors.targetAlive);
        felHoundLeechMarker.applyEffect(new BCEffect(function (this: any, thisEvent: BCEvent) {
            if (thisEvent.target) {
                BCDamage.event6a.register(thisEvent.target, felHoundLeechMarkerEffect, 1);
            }
        }));
        felHoundLeechMarker.expireEffect(new BCEffect(function (this: any, thisEvent: BCEvent) {
            if (thisEvent.target) {
                BCDamage.event6a.register(thisEvent.target, felHoundLeechMarkerEffect, -1);
                if (thisEvent.item.value > 0 && UnitAlive(thisEvent.target) && BCConstants.popupValue) {
                    let size = BCDamage.damagePopupSize;
                    let fac = thisEvent.value / BCDamage.damagePopupBase;
            
                    if (fac < 1 ) {
                        size *= Pow(1.25, fac) - 0.25;
                    }
                    else {
                        size *= 1.5 - 0.5 / fac;
                    }
                    new BCPopup('|cffcccccc' + I2S(R2I(thisEvent.item.value)) + '|r', thisEvent.target, size, size * 0.50);
                }
            }
        }));

BCApp.init(function() {
    let registerEffect = new BCEffect(function (this: any, thisEvent: BCEvent) {
        new BCBehavior(felHoundLeechMarker, thisEvent.target, thisEvent.target);
    });
    registerEffect.addValiador(new BCValiador(function (this: any, thisEvent: BCEvent) {
        return GetUnitAbilityLevel(thisEvent.target, felHoundLeechSkill) > 0;
    }));
    BCUnit.initEvent.register('global', registerEffect, 1);
});

class Legion {
    constructor() {
        
    }
}

export {Legion};