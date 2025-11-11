// Variables globales
let db = null;
let SQL = null;

// Inicializar la aplicación cuando se carga la página
window.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();
});

// Inicializar base de datos SQLite
async function initDatabase() {
    try {
        // Esperar a que initSqlJs esté disponible
        if (typeof initSqlJs === 'undefined') {
            await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (typeof initSqlJs !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);
            });
        }
        
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Intentar cargar la base de datos desde localStorage
        const savedDb = localStorage.getItem('inventario_db');
        if (savedDb) {
            const binaryString = atob(savedDb);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            db = new SQL.Database(bytes);
        } else {
            db = new SQL.Database();
            createTables();
        }
        
        console.log('Base de datos inicializada correctamente');
        
        // Configurar eventos
        setupEventListeners();
        
        // Cargar datos iniciales
        cargarConsultaMercancia();
        cargarHistorialRegistro();
        cargarHistorialVentas();
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        alert('Error al cargar la base de datos. Por favor, recarga la página.\n' + error.message);
    }
}

// Crear tablas en la base de datos
function createTables() {
    // Tabla de mercancía
    db.run(`
        CREATE TABLE IF NOT EXISTS mercancia (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio REAL NOT NULL,
            cantidad INTEGER NOT NULL,
            fecha_registro TEXT NOT NULL
        )
    `);
    
    // Tabla de ventas
    db.run(`
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mercancia_id INTEGER NOT NULL,
            nombre_mercancia TEXT NOT NULL,
            cantidad_vendida INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            total REAL NOT NULL,
            fecha_venta TEXT NOT NULL,
            FOREIGN KEY (mercancia_id) REFERENCES mercancia(id)
        )
    `);
    
    saveDatabase();
}

// Guardar base de datos en localStorage
function saveDatabase() {
    if (db) {
        try {
            const data = db.export();
            const uint8Array = new Uint8Array(data);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binary);
            localStorage.setItem('inventario_db', base64);
        } catch (error) {
            console.error('Error al guardar la base de datos:', error);
        }
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Formulario de registro
    document.getElementById('formRegistro').addEventListener('submit', handleRegistro);
    
    // Formulario de venta
    document.getElementById('formVenta').addEventListener('submit', handleVenta);
}

// Navegación entre secciones
function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Ocultar menú principal
    document.getElementById('mainMenu').style.display = 'none';
    
    // Mostrar la sección solicitada
    if (sectionId === 'mainMenu') {
        document.getElementById('mainMenu').style.display = 'grid';
    } else {
        document.getElementById(sectionId).classList.remove('hidden');
        
        // Cargar datos según la sección
        switch(sectionId) {
            case 'consulta':
                cargarConsultaMercancia();
                break;
            case 'venta':
                cargarMercanciasParaVenta();
                break;
            case 'historial-registro':
                cargarHistorialRegistro();
                break;
            case 'historial-ventas':
                cargarHistorialVentas();
                break;
        }
    }
}

// Manejar registro de mercancía
function handleRegistro(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const precio = parseFloat(document.getElementById('precio').value);
    const cantidad = parseInt(document.getElementById('cantidad').value);
    
    // Validaciones
    if (!nombre) {
        showMensaje('mensajeRegistro', 'Por favor, ingrese el nombre de la mercancía.', 'error');
        return;
    }
    
    if (precio <= 0 || isNaN(precio)) {
        showMensaje('mensajeRegistro', 'El precio debe ser mayor a 0.', 'error');
        return;
    }
    
    if (cantidad < 0 || isNaN(cantidad)) {
        showMensaje('mensajeRegistro', 'La cantidad debe ser mayor o igual a 0.', 'error');
        return;
    }
    
    try {
        const fecha = new Date().toISOString();
        
        db.run(
            'INSERT INTO mercancia (nombre, descripcion, precio, cantidad, fecha_registro) VALUES (?, ?, ?, ?, ?)',
            [nombre, descripcion || '', precio, cantidad, fecha]
        );
        
        saveDatabase();
        
        showMensaje('mensajeRegistro', 'Mercancía registrada exitosamente.', 'success');
        
        // Limpiar formulario
        document.getElementById('formRegistro').reset();
        
        // Actualizar listas
        setTimeout(() => {
            cargarConsultaMercancia();
            cargarHistorialRegistro();
            cargarMercanciasParaVenta();
        }, 500);
        
    } catch (error) {
        console.error('Error al registrar mercancía:', error);
        showMensaje('mensajeRegistro', 'Error al registrar la mercancía.', 'error');
    }
}

// Cargar mercancías para consulta
function cargarConsultaMercancia() {
    try {
        const result = db.exec('SELECT * FROM mercancia ORDER BY fecha_registro DESC');
        const tbody = document.getElementById('tbodyMercancia');
        
        if (result.length === 0 || result[0].values.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="icon">📦</div><p>No hay mercancía registrada</p></td></tr>';
            return;
        }
        
        const columns = result[0].columns;
        const values = result[0].values;
        
        tbody.innerHTML = values.map(row => {
            const id = row[columns.indexOf('id')];
            const nombre = row[columns.indexOf('nombre')];
            const descripcion = row[columns.indexOf('descripcion')] || '';
            const precio = parseFloat(row[columns.indexOf('precio')]);
            const cantidad = row[columns.indexOf('cantidad')];
            const fecha = new Date(row[columns.indexOf('fecha_registro')]).toLocaleDateString('es-ES');
            
            return `
                <tr>
                    <td>${id}</td>
                    <td>${escapeHtml(nombre)}</td>
                    <td>${escapeHtml(descripcion)}</td>
                    <td>$${precio.toFixed(2)}</td>
                    <td>${cantidad}</td>
                    <td>${fecha}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error al cargar mercancías:', error);
    }
}

// Buscar mercancía
function buscarMercancia() {
    const searchTerm = document.getElementById('buscarMercancia').value.trim().toLowerCase();
    const tbody = document.getElementById('tbodyMercancia');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Cargar mercancías para venta
function cargarMercanciasParaVenta() {
    try {
        const result = db.exec('SELECT id, nombre, precio, cantidad FROM mercancia WHERE cantidad > 0 ORDER BY nombre');
        const select = document.getElementById('mercanciaVenta');
        
        select.innerHTML = '<option value="">-- Seleccione una mercancía --</option>';
        
        if (result.length > 0 && result[0].values.length > 0) {
            const columns = result[0].columns;
            const values = result[0].values;
            
            values.forEach(row => {
                const id = row[columns.indexOf('id')];
                const nombre = row[columns.indexOf('nombre')];
                const precio = row[columns.indexOf('precio')];
                const cantidad = row[columns.indexOf('cantidad')];
                
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${escapeHtml(nombre)} - Stock: ${cantidad} - $${parseFloat(precio).toFixed(2)}`;
                option.dataset.precio = precio;
                option.dataset.cantidad = cantidad;
                option.dataset.nombre = nombre;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error al cargar mercancías para venta:', error);
    }
}

// Actualizar información de venta
function actualizarInfoVenta() {
    const select = document.getElementById('mercanciaVenta');
    const option = select.options[select.selectedIndex];
    const infoBox = document.getElementById('infoMercancia');
    
    if (option.value) {
        const precio = parseFloat(option.dataset.precio);
        const cantidad = parseInt(option.dataset.cantidad);
        
        document.getElementById('precioUnitario').textContent = `$${precio.toFixed(2)}`;
        document.getElementById('stockDisponible').textContent = cantidad;
        document.getElementById('cantidadVenta').max = cantidad;
        
        infoBox.classList.remove('hidden');
        calcularTotal();
    } else {
        infoBox.classList.add('hidden');
        document.getElementById('totalVenta').textContent = '$0.00';
    }
}

// Calcular total de venta
function calcularTotal() {
    const select = document.getElementById('mercanciaVenta');
    const cantidadInput = document.getElementById('cantidadVenta');
    const option = select.options[select.selectedIndex];
    
    if (option.value && cantidadInput.value) {
        const precio = parseFloat(option.dataset.precio);
        const cantidad = parseInt(cantidadInput.value);
        const total = precio * cantidad;
        
        document.getElementById('totalVenta').textContent = `$${total.toFixed(2)}`;
    } else {
        document.getElementById('totalVenta').textContent = '$0.00';
    }
}

// Manejar venta
function handleVenta(e) {
    e.preventDefault();
    
    const select = document.getElementById('mercanciaVenta');
    const cantidadVenta = parseInt(document.getElementById('cantidadVenta').value);
    const option = select.options[select.selectedIndex];
    
    // Validaciones
    if (!option.value) {
        showMensaje('mensajeVenta', 'Por favor, seleccione una mercancía.', 'error');
        return;
    }
    
    if (!cantidadVenta || cantidadVenta <= 0) {
        showMensaje('mensajeVenta', 'La cantidad debe ser mayor a 0.', 'error');
        return;
    }
    
    const stockDisponible = parseInt(option.dataset.cantidad);
    if (cantidadVenta > stockDisponible) {
        showMensaje('mensajeVenta', `No hay suficiente stock. Stock disponible: ${stockDisponible}`, 'error');
        return;
    }
    
    try {
        const mercanciaId = parseInt(option.value);
        const nombreMercancia = option.dataset.nombre;
        const precioUnitario = parseFloat(option.dataset.precio);
        const total = precioUnitario * cantidadVenta;
        const fecha = new Date().toISOString();
        
        // Registrar la venta
        db.run(
            'INSERT INTO ventas (mercancia_id, nombre_mercancia, cantidad_vendida, precio_unitario, total, fecha_venta) VALUES (?, ?, ?, ?, ?, ?)',
            [mercanciaId, nombreMercancia, cantidadVenta, precioUnitario, total, fecha]
        );
        
        // Actualizar stock
        const nuevaCantidad = stockDisponible - cantidadVenta;
        db.run(
            'UPDATE mercancia SET cantidad = ? WHERE id = ?',
            [nuevaCantidad, mercanciaId]
        );
        
        saveDatabase();
        
        showMensaje('mensajeVenta', `Venta registrada exitosamente. Total: $${total.toFixed(2)}`, 'success');
        
        // Limpiar formulario
        resetFormVenta();
        
        // Actualizar listas
        setTimeout(() => {
            cargarConsultaMercancia();
            cargarHistorialVentas();
            cargarMercanciasParaVenta();
        }, 500);
        
    } catch (error) {
        console.error('Error al registrar venta:', error);
        showMensaje('mensajeVenta', 'Error al registrar la venta.', 'error');
    }
}

// Resetear formulario de venta
function resetFormVenta() {
    document.getElementById('formVenta').reset();
    document.getElementById('infoMercancia').classList.add('hidden');
    document.getElementById('totalVenta').textContent = '$0.00';
}

// Cargar historial de registro
function cargarHistorialRegistro() {
    try {
        const result = db.exec('SELECT * FROM mercancia ORDER BY fecha_registro DESC');
        const tbody = document.getElementById('tbodyHistorialRegistro');
        
        if (result.length === 0 || result[0].values.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="icon">📋</div><p>No hay registros de mercancía</p></td></tr>';
            return;
        }
        
        const columns = result[0].columns;
        const values = result[0].values;
        
        tbody.innerHTML = values.map(row => {
            const id = row[columns.indexOf('id')];
            const nombre = row[columns.indexOf('nombre')];
            const descripcion = row[columns.indexOf('descripcion')] || '';
            const precio = parseFloat(row[columns.indexOf('precio')]);
            const cantidad = row[columns.indexOf('cantidad')];
            const fecha = new Date(row[columns.indexOf('fecha_registro')]).toLocaleString('es-ES');
            
            return `
                <tr>
                    <td>${id}</td>
                    <td>${escapeHtml(nombre)}</td>
                    <td>${escapeHtml(descripcion)}</td>
                    <td>$${precio.toFixed(2)}</td>
                    <td>${cantidad}</td>
                    <td>${fecha}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error al cargar historial de registro:', error);
    }
}

// Cargar historial de ventas
function cargarHistorialVentas() {
    try {
        const result = db.exec('SELECT * FROM ventas ORDER BY fecha_venta DESC');
        const tbody = document.getElementById('tbodyHistorialVentas');
        
        // Calcular estadísticas
        let totalVentas = 0;
        let ingresosTotales = 0;
        
        if (result.length > 0 && result[0].values.length > 0) {
            const columns = result[0].columns;
            const values = result[0].values;
            
            totalVentas = values.length;
            ingresosTotales = values.reduce((sum, row) => {
                return sum + parseFloat(row[columns.indexOf('total')]);
            }, 0);
            
            tbody.innerHTML = values.map(row => {
                const id = row[columns.indexOf('id')];
                const nombreMercancia = row[columns.indexOf('nombre_mercancia')];
                const cantidadVendida = row[columns.indexOf('cantidad_vendida')];
                const precioUnitario = parseFloat(row[columns.indexOf('precio_unitario')]);
                const total = parseFloat(row[columns.indexOf('total')]);
                const fecha = new Date(row[columns.indexOf('fecha_venta')]).toLocaleString('es-ES');
                
                return `
                    <tr>
                        <td>${id}</td>
                        <td>${escapeHtml(nombreMercancia)}</td>
                        <td>${cantidadVendida}</td>
                        <td>$${precioUnitario.toFixed(2)}</td>
                        <td><strong>$${total.toFixed(2)}</strong></td>
                        <td>${fecha}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="icon">💰</div><p>No hay ventas registradas</p></td></tr>';
        }
        
        // Actualizar estadísticas
        document.getElementById('totalVentas').textContent = totalVentas;
        document.getElementById('ingresosTotales').textContent = `$${ingresosTotales.toFixed(2)}`;
        
    } catch (error) {
        console.error('Error al cargar historial de ventas:', error);
    }
}

// Mostrar mensaje
function showMensaje(elementId, mensaje, tipo) {
    const mensajeElement = document.getElementById(elementId);
    mensajeElement.textContent = mensaje;
    mensajeElement.className = `mensaje ${tipo}`;
    mensajeElement.classList.remove('hidden');
    
    // Ocultar mensaje después de 5 segundos
    setTimeout(() => {
        mensajeElement.classList.add('hidden');
    }, 5000);
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
}
