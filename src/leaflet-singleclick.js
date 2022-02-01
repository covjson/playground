import L from 'leaflet'

// https://github.com/Outdooractive/leaflet-singleclick_0.7

L.Map.addInitHook( function () {

    var that = this
    ,   h
    ,   ignoreDragging = false
    ;

    if (that.on)
    {
        that.on( 'click',    check_later );
        that.on( 'dblclick', function () { setTimeout( clear_h, 0 ); } );
        that.on( 'dragstart', function () { ignoreDragging = true; } );
        that.on( 'dragend', function () { ignoreDragging = false; } );
    }

    function check_later( e )
    {
        clear_h();

        h = setTimeout( check, 300 );

        function check()
        {
            if (!ignoreDragging) {
                that.fire( 'singleclick', L.Util.extend( e, { type : 'singleclick' } ) );
            } else {
                ignoreDragging = false;
            }
        }
    }

    function clear_h()
    {
        if (h != null)
        {
            clearTimeout( h );
            h = null;
        }
    }

});