package com.psddev.cms.view;

import com.psddev.dari.db.ObjectType;
import com.psddev.dari.db.Recordable;
import com.psddev.dari.util.ObjectUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class ViewUtils {

    private ViewUtils() {
    }

    // Returns classes in order of input class followed by all interfaces and
    // super interfaces, followed by its super classes and their interfaces
    // and super interfaces, followed by its modification classes.
    static List<Class<?>> getAnnotatableClasses(Class<?> klass) {

        Set<Class<?>> classesToCheck = new LinkedHashSet<>();

        // add class and interfaces
        classesToCheck.add(klass);
        classesToCheck.addAll(getAllInterfaces(klass));

        // repeat for each super class
        Class<?> superClass = klass.getSuperclass();
        while (superClass != null) {
            if (!Object.class.equals(superClass)) {
                classesToCheck.add(superClass);
                classesToCheck.addAll(getAllInterfaces(superClass));
            }

            superClass = superClass.getSuperclass();
        }

        // check modification classes
        if (Recordable.class.isAssignableFrom(klass)) {
            ObjectType type = ObjectType.getInstance(klass);
            if (type != null) {
                for (String modClassName : type.getModificationClassNames()) {
                    Class<?> modClass = ObjectUtils.getClassByName(modClassName);
                    if (modClass != null) {
                        classesToCheck.add(modClass);
                    }
                }
            }
        }

        return new ArrayList<>(classesToCheck);
    }

    // fetches the interfaces for the given class including including any super
    // interfaces.
    private static Set<Class<?>> getAllInterfaces(Class<?> klass) {

        Set<Class<?>> interfaces = new HashSet<>();

        for (Class<?> interfaceClass : klass.getInterfaces()) {
            interfaces.add(interfaceClass);
            interfaces.addAll(getAllInterfaces(interfaceClass));
        }

        return interfaces;
    }
}
